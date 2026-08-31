import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as nodemailer from 'nodemailer';
import { connectToMongo, verifySession, extractToken } from './db';

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'shudarsanregmi555@gmail.com';

function createEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: OWNER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD || ''
    }
  });
}

export async function authHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;

  try {
    const db = await connectToMongo();

    // ── 1. Session Check ─────────────────────────────────────────────────────
    if (method === 'GET' && path.endsWith('/check')) {
      const token = extractToken(request);
      try {
        const isValid = await verifySession(token);
        return { status: 200, jsonBody: { authenticated: isValid } };
      } catch (err: any) {
        return { status: 200, jsonBody: { authenticated: false, error: err.message } };
      }
    }

    // ── 2. TOTP Setup ─────────────────────────────────────────────────────────
    if (method === 'GET' && path.endsWith('/totp-setup')) {
      const token = extractToken(request);
      const isSessionValid = await verifySession(token);

      const authConfig = await db.collection('auth').findOne({ key: 'totp' });

      // Hide secret from unauthenticated callers
      if (authConfig && !isSessionValid) {
        return { status: 200, jsonBody: { configured: true } };
      }

      let secretBase32 = '';
      let otpauthUrl = '';

      if (authConfig && authConfig.secret) {
        secretBase32 = authConfig.secret;
        otpauthUrl = `otpauth://totp/shudkara%20(${encodeURIComponent(OWNER_EMAIL)})?secret=${secretBase32}&issuer=shudkara`;
      } else {
        const secret = speakeasy.generateSecret({
          name: `shudkara (${OWNER_EMAIL})`,
          issuer: 'shudkara'
        });
        secretBase32 = secret.base32;
        otpauthUrl = secret.otpauth_url || '';
        await db.collection('auth').updateOne(
          { key: 'totp' },
          { $set: { secret: secretBase32 } },
          { upsert: true }
        );
      }

      return {
        status: 200,
        jsonBody: { configured: !!authConfig, secret: secretBase32, otpauthUrl }
      };
    }

    // ── 3. TOTP Reset (requires session) ──────────────────────────────────────
    if (method === 'POST' && path.endsWith('/totp-reset')) {
      const token = extractToken(request);
      if (!await verifySession(token)) {
        return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      }
      await db.collection('auth').deleteOne({ key: 'totp' });
      return { status: 200, jsonBody: { success: true, message: 'TOTP secret reset.' } };
    }

    // ── 4. Verify TOTP Code (primary auth once set up) ────────────────────────
    if (method === 'POST' && path.endsWith('/verify-totp')) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { code } = body;
      if (!code || typeof code !== 'string') {
        return { status: 400, jsonBody: { error: 'TOTP code is required.' } };
      }

      const authConfig = await db.collection('auth').findOne({ key: 'totp' });
      if (!authConfig?.secret) {
        return { status: 400, jsonBody: { error: 'TOTP not configured yet.' } };
      }

      const verified = speakeasy.totp.verify({
        secret: authConfig.secret,
        encoding: 'base32',
        token: code.trim(),
        window: 1
      });

      if (!verified) {
        return { status: 401, jsonBody: { error: 'Invalid TOTP code.' } };
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await db.collection('sessions').insertOne({ token: sessionToken, createdAt: new Date(), expiresAt });

      return { status: 200, jsonBody: { success: true, token: sessionToken } };
    }

    // ── 5. Send Email OTP (primary auth — bootstrap before TOTP is set up) ────
    if (method === 'POST' && path.endsWith('/send-otp')) {
      const appPassword = process.env.GMAIL_APP_PASSWORD;
      if (!appPassword) {
        return { status: 500, jsonBody: { error: 'Email OTP not configured on server. Add GMAIL_APP_PASSWORD env var.' } };
      }

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP (one active at a time per email)
      await db.collection('otps').updateOne(
        { email: OWNER_EMAIL },
        { $set: { email: OWNER_EMAIL, otp, expiresAt, createdAt: new Date() } },
        { upsert: true }
      );

      // Send email
      const transporter = createEmailTransporter();
      await transporter.sendMail({
        from: `"shudkara" <${OWNER_EMAIL}>`,
        to: OWNER_EMAIL,
        subject: `shudkara Login Code: ${otp}`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1e293b; margin-bottom: 8px;">shudkara Login</h2>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Your one-time login code is:</p>
            <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center;">
              <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #1e293b; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Expires in 10 minutes. Do not share this code.</p>
          </div>
        `
      });

      return { status: 200, jsonBody: { success: true, message: 'OTP sent to your email.' } };
    }

    // ── 6. Verify Email OTP ────────────────────────────────────────────────────
    if (method === 'POST' && path.endsWith('/verify-otp')) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { code } = body;
      if (!code || typeof code !== 'string') {
        return { status: 400, jsonBody: { error: 'OTP code is required.' } };
      }

      const record = await db.collection('otps').findOne({ email: OWNER_EMAIL });
      if (!record) {
        return { status: 401, jsonBody: { error: 'No OTP found. Please request a new code.' } };
      }

      if (new Date(record.expiresAt).getTime() < Date.now()) {
        await db.collection('otps').deleteOne({ email: OWNER_EMAIL });
        return { status: 401, jsonBody: { error: 'OTP has expired. Please request a new code.' } };
      }

      if (record.otp !== code.trim()) {
        return { status: 401, jsonBody: { error: 'Invalid OTP. Please check your email and try again.' } };
      }

      // Consume OTP
      await db.collection('otps').deleteOne({ email: OWNER_EMAIL });

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await db.collection('sessions').insertOne({ token: sessionToken, createdAt: new Date(), expiresAt });

      return { status: 200, jsonBody: { success: true, token: sessionToken } };
    }

    // ── 7. Logout ─────────────────────────────────────────────────────────────
    if (method === 'POST' && path.endsWith('/logout')) {
      const token = extractToken(request);
      if (token) {
        await db.collection('sessions').deleteOne({ token });
      }
      return { status: 200, jsonBody: { success: true, message: 'Logged out.' } };
    }

    return { status: 404, jsonBody: { error: 'Route not found.' } };
  } catch (err: any) {
    context.error('Auth handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('auth', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'auth/{*action}',
  handler: authHandler
});
