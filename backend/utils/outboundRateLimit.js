/**
 * Outbound rate limiter for integrated public APIs.
 * Prevents our backend from abusing third-party services (reCAPTCHA, Google Drive/Sheets/Calendar, SMTP).
 * Sir Klevie: "Public API we integrate… put a limiter so it cannot be abused."
 */

const WINDOW_MS = 60_000; // 1 minute
const store = new Map();

export class OutboundRateLimitError extends Error {
  constructor(scope) {
    super(`Outbound rate limit exceeded for ${scope}`);
    this.name = "OutboundRateLimitError";
    this.scope = scope;
  }
}

/**
 * Check if we are under the outbound rate limit for the given scope.
 * @param {string} scope - 'recaptcha', 'gdrive', 'gsheets', 'gcal', 'smtp'
 * @param {number} maxPerMinute - max calls per minute
 * @param {string} [key='global'] - e.g. IP for recaptcha
 * @throws {OutboundRateLimitError} when over limit
 */
export function checkOutboundLimit(scope, maxPerMinute, key = "global") {
  const k = `${scope}:${key}`;
  const now = Date.now();
  let entry = store.get(k);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    store.set(k, entry);
  }
  entry.count += 1;
  if (entry.count > maxPerMinute) {
    throw new OutboundRateLimitError(scope);
  }
}

/**
 * Rate-limited sendMail: checks SMTP outbound limit, then transporter.sendMail.
 * @param {object} transporter - nodemailer transporter
 * @param {object} mailOptions - options for transporter.sendMail
 */
export async function rateLimitedSendMail(transporter, mailOptions) {
  checkOutboundLimit("smtp", 60, "global");
  return transporter.sendMail(mailOptions);
}
