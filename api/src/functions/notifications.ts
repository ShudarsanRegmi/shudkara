import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import webpush from 'web-push';
import { connectToMongo, verifySession, extractToken, logAppError } from './db';

const DEFAULT_VAPID_PUBLIC_KEY = 'BGnP0LHOR8VW63Dgz4AhgZ_FBkb1is5fM8n4KdW8YK9Lui4vIUhLG45vWkmsxxwTPheJoYImh0kCJtYEXg0_0xs';
const DEFAULT_VAPID_PRIVATE_KEY = '7jhh1aGcgsRlS2OIVh50zMifeB5KyCNjoTbCo9l-_1U';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@shudkara.com';

/**
 * Retrieves existing VAPID keys from env or MongoDB system_config, or persists default keys.
 */
export async function getOrInitVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: VAPID_SUBJECT
    };
  }

  try {
    const db = await connectToMongo();
    const configCol = db.collection('system_config');
    const existing = await configCol.findOne({ _id: 'vapid_keys' as any });

    if (existing && existing.publicKey && existing.privateKey) {
      return {
        publicKey: existing.publicKey as string,
        privateKey: existing.privateKey as string,
        subject: VAPID_SUBJECT
      };
    }

    // Persist default keys so they remain stable across deployments
    await configCol.updateOne(
      { _id: 'vapid_keys' as any },
      {
        $set: {
          publicKey: DEFAULT_VAPID_PUBLIC_KEY,
          privateKey: DEFAULT_VAPID_PRIVATE_KEY,
          subject: VAPID_SUBJECT,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  } catch (dbErr) {
    console.warn('Could not read/write VAPID keys to MongoDB, using built-in defaults:', dbErr);
  }

  return {
    publicKey: DEFAULT_VAPID_PUBLIC_KEY,
    privateKey: DEFAULT_VAPID_PRIVATE_KEY,
    subject: VAPID_SUBJECT
  };
}

/**
 * Dispatches a native Web Push Notification to all registered PWA subscriptions.
 * Automatically cleans up invalid/expired subscriptions (HTTP 410 Gone / 404).
 */
export async function sendPushNotificationToAll(payload: {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}): Promise<{ sent: number; failed: number; pruned: number }> {
  try {
    const db = await connectToMongo();
    const subCol = db.collection('push_subscriptions');
    const subscriptions = await subCol.find({}).toArray();

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, pruned: 0 };
    }

    const keys = await getOrInitVapidKeys();
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/favicon.svg',
      tag: payload.tag || 'shudkara-alert',
      url: payload.url || '/',
      data: {
        url: payload.url || '/',
        timestamp: Date.now(),
        ...payload.data
      }
    });

    let sent = 0;
    let failed = 0;
    let pruned = 0;

    for (const subDoc of subscriptions) {
      const pushSubscription = {
        endpoint: subDoc.endpoint,
        keys: {
          p256dh: subDoc.keys?.p256dh,
          auth: subDoc.keys?.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription as any, notificationPayload);
        sent++;
      } catch (pushErr: any) {
        failed++;
        // Prune expired or revoked endpoints
        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
          await subCol.deleteOne({ _id: subDoc._id });
          pruned++;
        }
      }
    }

    return { sent, failed, pruned };
  } catch (err: any) {
    console.error('Failed to send push notification to all:', err);
    return { sent: 0, failed: 1, pruned: 0 };
  }
}

export async function notificationsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/notifications\/?/, '').split('/').filter(Boolean);

  try {
    const db = await connectToMongo();
    const subCol = db.collection('push_subscriptions');

    // ── 1. GET /api/notifications/vapid-public-key (Public Key Discovery) ──
    if (method === 'GET' && pathParts[0] === 'vapid-public-key') {
      const keys = await getOrInitVapidKeys();
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          publicKey: keys.publicKey
        }
      };
    }

    // Authentication required for subscription management & testing
    const token = extractToken(request);
    const isAuthorized = await verifySession(token);
    if (!isAuthorized) {
      return { status: 401, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Unauthorized.' } };
    }

    // ── 2. GET /api/notifications/status ──
    if (method === 'GET' && pathParts[0] === 'status') {
      const count = await subCol.countDocuments({});
      const keys = await getOrInitVapidKeys();
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          activeSubscriptions: count,
          hasPublicKey: !!keys.publicKey
        }
      };
    }

    // ── 3. POST /api/notifications/subscribe (Register PWA device) ──
    if (method === 'POST' && pathParts[0] === 'subscribe') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const subscription = body.subscription;
      if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Valid PushSubscription with endpoint and keys required.' } };
      }

      await subCol.updateOne(
        { endpoint: subscription.endpoint },
        {
          $set: {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userAgent: body.userAgent || request.headers.get('user-agent') || 'Unknown',
            updatedAt: new Date(),
            token
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, message: 'Push subscription registered.' }
      };
    }

    // ── 4. POST /api/notifications/unsubscribe ──
    if (method === 'POST' && pathParts[0] === 'unsubscribe') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const endpoint = body.endpoint;
      if (endpoint) {
        await subCol.deleteOne({ endpoint });
      }
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, message: 'Unsubscribed from push notifications.' }
      };
    }

    // ── 5. POST /api/notifications/test-push (Trigger test push notification) ──
    if (method === 'POST' && pathParts[0] === 'test-push') {
      let body: any = {};
      try { body = await request.json(); } catch {}

      const title = body.title || '🌟 Shudkara System Connected';
      const text = body.body || 'Your PWA is successfully receiving system push notifications from the server!';
      const targetUrl = body.url || '/';

      const result = await sendPushNotificationToAll({
        title,
        body: text,
        url: targetUrl,
        tag: 'test-push'
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: true,
          ...result,
          message: `Dispatched push to ${result.sent} active device(s).`
        }
      };
    }

    return { status: 405, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Notifications handler error:', err);
    await logAppError('notifications', err, { method, url: request.url, pathParts });
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: { error: 'Internal server error.', details: err?.message || String(err) }
    };
  }
}

app.http('notifications', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'notifications/{*subpath}',
  handler: notificationsHandler
});
