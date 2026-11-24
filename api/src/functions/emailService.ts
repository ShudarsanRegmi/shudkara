import * as nodemailer from 'nodemailer';

export const OWNER_EMAIL = process.env.OWNER_EMAIL || 'shudarsanregmi555@gmail.com';

// Whitelist of allowed direct recipients
const OWNER_WHITELIST = new Set([
  OWNER_EMAIL.toLowerCase(),
  'shudarsanregmi.work@gmail.com'.toLowerCase()
]);

// Blocked dummy / mock / external sample domains that must never be messaged directly
const BLOCKED_DOMAINS = [
  'example.com',
  'example.org',
  'test.com',
  'test.org',
  'sfr.fr',
  'mailinator.com',
  'tempmail.com',
  'localhost',
  'nexustech.com'
];

/**
 * Returns a configured nodemailer transporter for the system's Gmail account.
 */
export function createEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: OWNER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD || ''
    }
  });
}

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: any[];
}

export interface SendMailResult {
  accepted: string[];
  rejected: string[];
  messageId?: string;
  redirected: boolean;
  originalRecipient: string;
  finalRecipient: string;
}

/**
 * Universal safe email sender.
 * Enforces strict sandbox and recipient isolation:
 * 1. Checks for valid email address syntax.
 * 2. Checks against blocked test/demo domains (e.g. sfr.fr, example.com).
 * 3. Unless ALLOW_EXTERNAL_EMAILS === 'true', redirects ANY external non-owner email
 *    safely to OWNER_EMAIL with a prominent diagnostic warning banner and subject tag.
 * This guarantees that during testing, development, and audits, NO accidental emails
 * are dispatched to random or third-party email addresses.
 */
export async function sendSafeMail(options: SendMailOptions): Promise<SendMailResult> {
  const transporter = createEmailTransporter();
  const rawTo = (options.to || '').trim().toLowerCase();

  if (!rawTo || !rawTo.includes('@')) {
    throw new Error(`Cannot send email: invalid recipient address '${options.to}'`);
  }

  const domain = rawTo.split('@')[1] || '';
  const isBlockedDomain = BLOCKED_DOMAINS.some(b => domain === b || domain.endsWith('.' + b));
  const isOwner = OWNER_WHITELIST.has(rawTo);
  const allowExternal = process.env.ALLOW_EXTERNAL_EMAILS === 'true';

  let finalRecipient = options.to.trim();
  let redirected = false;
  let subject = options.subject;
  let html = options.html || '';

  // Intercept if:
  // 1) Domain is in blocked test/demo domains, OR
  // 2) Recipient is external and ALLOW_EXTERNAL_EMAILS is not explicitly enabled
  if (isBlockedDomain || (!isOwner && !allowExternal)) {
    redirected = true;
    finalRecipient = OWNER_EMAIL;
    subject = `[SANDBOX INTERCEPT -> ${options.to.trim()}] ${options.subject}`;

    const reason = isBlockedDomain
      ? `Blocked domain (${domain}) detected in test/demo recipient`
      : 'External email dispatch is disabled in this environment (ALLOW_EXTERNAL_EMAILS is not set to true)';

    const banner = `
      <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #991b1b; font-size: 13px; line-height: 1.5;">
        <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          🛡️ SHUDKARA EMAIL SAFETY INTERCEPTOR
        </div>
        <div>
          <strong>Original Target:</strong> <code style="color: #7f1d1d; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${options.to}</code><br/>
          <strong>Reason:</strong> ${reason}.<br/>
          <strong>Safe Redirect:</strong> Delivered to system owner (<code>${OWNER_EMAIL}</code>) to prevent accidental email dispatch to external or unverified recipients.
        </div>
      </div>
    `;

    if (html) {
      if (html.includes('<body')) {
        html = html.replace(/<body[^>]*>/i, (match) => `${match}\n${banner}`);
      } else {
        html = banner + html;
      }
    } else {
      html = banner + `<pre>${options.text || ''}</pre>`;
    }

    console.warn(`[EMAIL SAFETY GUARD] Intercepted email to '${options.to}'. Reason: ${reason}. Safely rerouted to '${OWNER_EMAIL}'.`);
  }

  const result = await transporter.sendMail({
    ...options,
    to: finalRecipient,
    subject,
    html: html || undefined
  });

  return {
    accepted: (result.accepted || []) as string[],
    rejected: (result.rejected || []) as string[],
    messageId: result.messageId,
    redirected,
    originalRecipient: options.to,
    finalRecipient
  };
}
