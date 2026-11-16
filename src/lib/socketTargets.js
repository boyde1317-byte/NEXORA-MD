/**
 * socketTargets.js — shared target/reason parsing for the socket-feature
 * commands (username, spam reporting, registration).
 *
 * These commands wrap the baileys r22 socket surface, so targets must arrive
 * as real JIDs: a mention, a quoted sender, or a raw number/JID argument.
 */

export const REPORT_REASONS = ['spam', 'harassment', 'impersonation', 'scam', 'other'];

/**
 * Normalize a raw argument to a JID. Bare numbers (6+ digits) become
 * phone-number JIDs; anything already containing '@' passes through with
 * the device suffix stripped. Returns null when the arg is not a target
 * (short numbers are treated as counts elsewhere, not JIDs).
 */
export function normalizeJidInput(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith('@')) s = s.slice(1);
  if (s.includes('@')) {
    const [user, domain] = s.split('@');
    if (!user || !domain) return null;
    return `${user.split(':')[0]}@${domain}`;
  }
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length < 6) return null;
  return `${digits}@s.whatsapp.net`;
}

/** Mention first, then quoted sender, then the first target-like argument. */
export function resolveTargetJid(m, args = []) {
  if (Array.isArray(m?.mentioned) && m.mentioned.length > 0) return m.mentioned[0];
  if (m?.quoted?.sender) return m.quoted.sender;
  for (const arg of args) {
    const jid = normalizeJidInput(arg);
    if (jid) return jid;
  }
  return null;
}

/** First reason-like argument wins; default is 'spam'. */
export function parseReportReason(args = []) {
  for (const arg of args) {
    const v = String(arg).toLowerCase();
    if (REPORT_REASONS.includes(v)) return v;
  }
  return 'spam';
}

/** Strip a leading @ and surrounding whitespace; otherwise pass through. */
export function normalizeUsername(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/^@+/, '').trim();
}

/** Guard for sockets running an older baileys without the r22 surface. */
export function hasSocketMethod(sock, method) {
  return Boolean(sock) && typeof sock[method] === 'function';
}
