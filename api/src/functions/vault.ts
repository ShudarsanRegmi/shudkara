import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import { connectToMongo, verifySession, extractToken, logAppError } from './db';

// In-memory fallback stores in case MongoDB is temporarily in-flight or offline
const inMemoryRelaySessions = new Map<string, {
  sessionId: string;
  publicKey: any;
  status: 'pending' | 'authorized' | 'expired';
  encryptedMvkPayload?: any;
  createdAt: number;
  expiresAt: number;
}>();

// Purge expired in-memory sessions every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, sess] of inMemoryRelaySessions.entries()) {
    if (sess.expiresAt < now) {
      inMemoryRelaySessions.delete(key);
    }
  }
}, 30000);

export async function vaultHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, '');
  const action = (request.params.action || '').replace(/^\/+/, '');

  // Handle CORS pre-flight
  if (method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token'
      }
    };
  }

  try {
    let db: any = null;
    try {
      db = await connectToMongo();
    } catch (dbErr) {
      context.warn('[Vault API] MongoDB connection fallback to memory:', dbErr);
    }

    // ── 1. RELAY ENDPOINTS (Method A: Ephemeral ECDH Companion QR Code Relay) ──

    // 1.1 POST /api/vault/relay/init (Laptop requests pairing ticket)
    if (method === 'POST' && (action === 'relay/init' || path.endsWith('relay/init'))) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { sessionId, publicKey } = body;
      if (!sessionId || !publicKey) {
        return { status: 400, jsonBody: { error: 'sessionId and publicKey are required.' } };
      }

      const now = Date.now();
      const expiresAt = now + 90 * 1000; // 90 seconds lifetime for QR clearance

      if (db) {
        const relayCol = db.collection('vault_relay_sessions');
        await relayCol.updateOne(
          { sessionId },
          {
            $set: {
              sessionId,
              publicKey,
              status: 'pending',
              createdAt: new Date(now),
              expiresAt: new Date(expiresAt)
            }
          },
          { upsert: true }
        );
      }

      inMemoryRelaySessions.set(sessionId, {
        sessionId,
        publicKey,
        status: 'pending',
        createdAt: now,
        expiresAt
      });

      return {
        status: 200,
        jsonBody: {
          success: true,
          sessionId,
          ticket: sessionId,
          expiresAt: new Date(expiresAt).toISOString()
        }
      };
    }

    // 1.2 POST /api/vault/relay/authorize (Phone authorizes laptop with encrypted MVK payload)
    if (method === 'POST' && (action === 'relay/authorize' || path.endsWith('relay/authorize'))) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { sessionId, encryptedMvkPayload } = body;
      if (!sessionId || !encryptedMvkPayload) {
        return { status: 400, jsonBody: { error: 'sessionId and encryptedMvkPayload are required.' } };
      }

      const now = Date.now();
      let sessionFound = false;

      if (db) {
        const relayCol = db.collection('vault_relay_sessions');
        const sess = await relayCol.findOne({ sessionId });
        if (sess && new Date(sess.expiresAt).getTime() > now) {
          await relayCol.updateOne(
            { sessionId },
            {
              $set: {
                status: 'authorized',
                encryptedMvkPayload,
                authorizedAt: new Date(now)
              }
            }
          );
          sessionFound = true;
        }
      }

      const memSess = inMemoryRelaySessions.get(sessionId);
      if (memSess && memSess.expiresAt > now) {
        memSess.status = 'authorized';
        memSess.encryptedMvkPayload = encryptedMvkPayload;
        sessionFound = true;
      }

      if (!sessionFound) {
        return { status: 404, jsonBody: { error: 'Relay pairing session expired or not found.' } };
      }

      return { status: 200, jsonBody: { success: true } };
    }

    // 1.3 GET /api/vault/relay/status?sessionId=... (Laptop polls pairing status)
    if (method === 'GET' && (action === 'relay/status' || path.endsWith('relay/status'))) {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        return { status: 400, jsonBody: { error: 'sessionId query parameter is required.' } };
      }

      const now = Date.now();
      let session: any = null;

      if (db) {
        const relayCol = db.collection('vault_relay_sessions');
        session = await relayCol.findOne({ sessionId });
      }

      if (!session) {
        session = inMemoryRelaySessions.get(sessionId);
      }

      if (!session) {
        return { status: 404, jsonBody: { status: 'expired', error: 'Session not found or expired.' } };
      }

      const expTime = session.expiresAt instanceof Date ? session.expiresAt.getTime() : session.expiresAt;
      if (expTime < now) {
        if (db) {
          await db.collection('vault_relay_sessions').deleteOne({ sessionId });
        }
        inMemoryRelaySessions.delete(sessionId);
        return { status: 200, jsonBody: { status: 'expired' } };
      }

      if (session.status === 'authorized') {
        const payload = session.encryptedMvkPayload;
        // Zero-knowledge & forward secrecy: immediately consume/destroy the authorized session
        if (db) {
          await db.collection('vault_relay_sessions').deleteOne({ sessionId });
        }
        inMemoryRelaySessions.delete(sessionId);

        return {
          status: 200,
          jsonBody: {
            status: 'authorized',
            encryptedMvkPayload: payload
          }
        };
      }

      return {
        status: 200,
        jsonBody: {
          status: 'pending',
          publicKey: session.publicKey
        }
      };
    }

    // ── 2. TOTP AUTHENTICATOR FALLBACK VERIFICATION ──────────────────────────
    if (method === 'POST' && (action === 'verify-totp' || path.endsWith('verify-totp'))) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { code } = body;
      if (!code || typeof code !== 'string') {
        return { status: 400, jsonBody: { error: 'TOTP code string is required.' } };
      }

      if (!db) {
        return { status: 503, jsonBody: { error: 'Database service unavailable.' } };
      }

      const authConfig = await db.collection('auth').findOne({ key: 'totp' });
      if (!authConfig || !authConfig.secret) {
        return { status: 400, jsonBody: { error: 'TOTP Authenticator is not configured on this account yet.' } };
      }

      const isValid = speakeasy.totp.verify({
        secret: authConfig.secret,
        encoding: 'base32',
        token: code.trim(),
        window: 1 // +/- 30s window tolerance
      });

      return {
        status: 200,
        jsonBody: {
          valid: isValid
        }
      };
    }

    // ── 3. VAULT MANIFEST PERSISTENCE (.vault_manifest.enc) ──────────────────

    // 3.1 GET /api/vault/manifest
    if (method === 'GET' && (action === 'manifest' || path.endsWith('manifest'))) {
      const token = extractToken(request);
      const isAuthorized = await verifySession(token);
      if (!isAuthorized) {
        return { status: 401, jsonBody: { error: 'Unauthorized. Shudkara session required.' } };
      }

      if (!db) {
        return { status: 503, jsonBody: { error: 'Database unavailable.' } };
      }

      const manifestDoc = await db.collection('vault_manifests').findOne({ key: 'primary_manifest' });
      if (!manifestDoc) {
        return { status: 404, jsonBody: { error: 'No encrypted manifest initialized yet.' } };
      }

      return {
        status: 200,
        jsonBody: {
          manifestCiphertext: manifestDoc.manifestCiphertext,
          iv: manifestDoc.iv,
          version: manifestDoc.version || 2,
          updatedAt: manifestDoc.updatedAt
        }
      };
    }

    // 3.2 POST /api/vault/manifest
    if (method === 'POST' && (action === 'manifest' || path.endsWith('manifest'))) {
      const token = extractToken(request);
      const isAuthorized = await verifySession(token);
      if (!isAuthorized) {
        return { status: 401, jsonBody: { error: 'Unauthorized. Shudkara session required.' } };
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { manifestCiphertext, iv, version } = body;
      if (!manifestCiphertext || !iv) {
        return { status: 400, jsonBody: { error: 'manifestCiphertext and iv are required.' } };
      }

      if (!db) {
        return { status: 503, jsonBody: { error: 'Database unavailable.' } };
      }

      const now = new Date();
      await db.collection('vault_manifests').updateOne(
        { key: 'primary_manifest' },
        {
          $set: {
            key: 'primary_manifest',
            manifestCiphertext,
            iv,
            version: version || 2,
            updatedAt: now.toISOString()
          }
        },
        { upsert: true }
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          updatedAt: now.toISOString()
        }
      };
    }

    // ── 4. ENCRYPTED BLOB STORAGE (/api/vault/blob) ──────────────────────────

    // 4.1 POST /api/vault/blob/upload
    if (method === 'POST' && (action === 'blob/upload' || path.endsWith('blob/upload'))) {
      const token = extractToken(request);
      const isAuthorized = await verifySession(token);
      if (!isAuthorized) {
        return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { blobUuid, ciphertextBase64, mimeType } = body;
      if (!blobUuid || !ciphertextBase64) {
        return { status: 400, jsonBody: { error: 'blobUuid and ciphertextBase64 are required.' } };
      }

      if (!db) {
        return { status: 503, jsonBody: { error: 'Database unavailable.' } };
      }

      const cleanUuid = blobUuid.trim().replace(/[^a-zA-Z0-9._-]/g, '');
      await db.collection('vault_blobs').updateOne(
        { blobUuid: cleanUuid },
        {
          $set: {
            blobUuid: cleanUuid,
            ciphertextBase64,
            mimeType: mimeType || 'image/jpeg',
            size: ciphertextBase64.length,
            uploadedAt: new Date()
          }
        },
        { upsert: true }
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          blobUuid: cleanUuid
        }
      };
    }

    // 4.2 GET /api/vault/blob/{blobUuid}
    if (method === 'GET' && action.startsWith('blob/')) {
      const token = extractToken(request);
      const isAuthorized = await verifySession(token);
      if (!isAuthorized) {
        return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      }

      const targetUuid = action.replace(/^blob\//, '').trim();
      if (!targetUuid) {
        return { status: 400, jsonBody: { error: 'blobUuid parameter required.' } };
      }

      if (!db) {
        return { status: 503, jsonBody: { error: 'Database unavailable.' } };
      }

      const blobDoc = await db.collection('vault_blobs').findOne({ blobUuid: targetUuid });
      if (!blobDoc) {
        return { status: 404, jsonBody: { error: 'Encrypted blob not found.' } };
      }

      return {
        status: 200,
        jsonBody: {
          blobUuid: blobDoc.blobUuid,
          ciphertextBase64: blobDoc.ciphertextBase64,
          mimeType: blobDoc.mimeType
        }
      };
    }

    return { status: 404, jsonBody: { error: `Vault endpoint not found: ${action || path}` } };
  } catch (err: any) {
    context.error('Vault API error:', err);
    await logAppError('vault_api', err, { action, path });
    return { status: 500, jsonBody: { error: 'Internal server error in vault API.', details: err.message } };
  }
}

app.http('vault', {
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'vault/{*action}',
  handler: vaultHandler
});
