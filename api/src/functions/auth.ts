import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import { connectToMongo, verifySession } from './db';

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'shudarsanregmi555@gmail.com';

export async function authHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;

  try {
    const db = await connectToMongo();
    
    // 1. Check Session Status
    if (method === 'GET' && path.endsWith('/check')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '').trim();
      const isValid = await verifySession(token);
      return {
        status: 200,
        jsonBody: { authenticated: isValid }
      };
    }

    // 2. TOTP Setup (returns secret + otpauthUrl if not configured yet)
    if (method === 'GET' && path.endsWith('/totp-setup')) {
      const authConfig = await db.collection('auth').findOne({ key: 'totp' });
      if (authConfig) {
        return {
          status: 200,
          jsonBody: { configured: true }
        };
      }

      // Generate a new key secret if not configured
      const secret = speakeasy.generateSecret({
        name: `shudkara (${OWNER_EMAIL})`,
        issuer: 'shudkara'
      });

      // Save temporarily/pending or save permanently. Let's save permanently so they scan it once.
      await db.collection('auth').updateOne(
        { key: 'totp' },
        { $set: { secret: secret.base32 } },
        { upsert: true }
      );

      return {
        status: 200,
        jsonBody: {
          configured: false,
          secret: secret.base32,
          otpauthUrl: secret.otpauth_url
        }
      };
    }

    // 3. Verify TOTP Code
    if (method === 'POST' && path.endsWith('/verify-totp')) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { code } = body;
      if (!code || typeof code !== 'string') {
        return { status: 400, jsonBody: { error: 'TOTP code is required.' } };
      }

      const authConfig = await db.collection('auth').findOne({ key: 'totp' });
      if (!authConfig || !authConfig.secret) {
        return { status: 400, jsonBody: { error: 'TOTP is not configured yet. Please visit setup.' } };
      }

      const verified = speakeasy.totp.verify({
        secret: authConfig.secret,
        encoding: 'base32',
        token: code.trim(),
        window: 1 // 30s clock drift tolerance
      });

      if (!verified) {
        return { status: 401, jsonBody: { error: 'Invalid TOTP code.' } };
      }

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      await db.collection('sessions').insertOne({
        token: sessionToken,
        createdAt: new Date(),
        expiresAt
      });

      return {
        status: 200,
        jsonBody: { success: true, token: sessionToken }
      };
    }

    // 4. Firebase Email login success callback
    if (method === 'POST' && path.endsWith('/firebase-login')) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { email } = body;
      if (!email || typeof email !== 'string') {
        return { status: 400, jsonBody: { error: 'Email is required.' } };
      }

      if (email.trim().toLowerCase() !== OWNER_EMAIL.trim().toLowerCase()) {
        return { status: 403, jsonBody: { error: 'Access denied: You are not the owner of this application.' } };
      }

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      await db.collection('sessions').insertOne({
        token: sessionToken,
        createdAt: new Date(),
        expiresAt
      });

      return {
        status: 200,
        jsonBody: { success: true, token: sessionToken }
      };
    }

    // 5. Logout
    if (method === 'POST' && path.endsWith('/logout')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '').trim();
      if (token) {
        await db.collection('sessions').deleteOne({ token });
      }
      return {
        status: 200,
        jsonBody: { success: true, message: 'Logged out.' }
      };
    }

    return { status: 404, jsonBody: { error: 'Route not found.' } };
  } catch (err: any) {
    context.error('Auth handler error:', err);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error.', details: err.message }
    };
  }
}

app.http('auth', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'auth/{*action}',
  handler: authHandler
});
