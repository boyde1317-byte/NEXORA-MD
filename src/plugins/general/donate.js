/**
 * donate.js — .donate / .donation — QRIS donation via Pakasir.
 *
 * Ported from LUNA MD plugins/main-donate.js (QRIS donation).
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `m.chat` -> `m.from`; `conn.sendMessage` -> `sock.sendMessage`.
 *   - The blocking polling loop is GONE. The original sat in a
 *     `while (status !== 'completed')` loop with 10s sleeps, holding the
 *     handler (and the dispatcher's slot) open until the payment
 *     completed or expired. This port sends the QR + payment details
 *     once and returns immediately. Payment confirmation is the donor's
 *     / Pakasir dashboard's job — re-run `.donate <amount>` for a fresh
 *     QR if the old one expires.
 *   - Pakasir project slug + API key are NOT in this file. Fill in the
 *     two placeholders below (or wire them to env/config) before use.
 *     Never commit a real key here.
 *   - Amounts are IDR (Pakasir QRIS is Indonesian); min 1,000, max
 *     1,000,000, same as the original.
 *   - No DB fields used.
 */

// ── Pakasir credentials — FILL THESE IN, never commit a real key ──────────
// Get a project slug + API key from https://app.pakasir.com (Pakasir
// dashboard -> your QRIS project). Keep them out of git; env vars or
// the bot config are the right home for the real values.
const PAKASIR_PROJECT_SLUG = 'PASTE_YOUR_PAKASIR_PROJECT_SLUG_HERE';
const PAKASIR_API_KEY = 'PASTE_YOUR_PAKASIR_API_KEY_HERE';
// ─────────────────────────────────────────────────────────────────────────

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 1000000;

const fmtIDR = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;

async function createQris(project, apikey, amount) {
  const orderId = `NEXORA_MD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const res = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, order_id: orderId, amount, api_key: apikey }),
  });
  if (!res.ok) throw new Error(`Pakasir HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.payment) throw new Error('Pakasir did not return a payment.');
  return data.payment;
}

export default {
  name: 'donate',
  aliases: ['donation'],
  category: 'general',
  description: 'Donate to NEXORA MD via QRIS. Usage: .donate <amount in IDR>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const amount = parseInt(args[0], 10);
    if (!amount || Number.isNaN(amount)) {
      return m.reply(`💳 *QRIS DONATION — NEXORA MD*\n\nUsage: \`${p}donate <amount>\`\nExample: \`${p}donate 10000\`\n\nMinimum ${fmtIDR(MIN_AMOUNT)} • Maximum ${fmtIDR(MAX_AMOUNT)}`);
    }
    if (amount < MIN_AMOUNT) return m.reply.warn(`Minimum donation is ${fmtIDR(MIN_AMOUNT)}.`);
    if (amount > MAX_AMOUNT) return m.reply.warn(`Maximum donation is ${fmtIDR(MAX_AMOUNT)}.`);

    if (!PAKASIR_PROJECT_SLUG || PAKASIR_PROJECT_SLUG.startsWith('PASTE_YOUR_')
      || !PAKASIR_API_KEY || PAKASIR_API_KEY.startsWith('PASTE_YOUR_')) {
      return m.reply.error('Donations are not set up yet — the owner still needs to add the Pakasir project slug and API key.');
    }

    let payment;
    try {
      payment = await createQris(PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY, amount);
    } catch (err) {
      console.warn('[donate] QRIS creation failed:', err.message);
      return m.reply.error(`Could not create the QRIS payment: ${err.message}`);
    }

    const expiredAt = payment.expired_at ? new Date(payment.expired_at) : null;
    const expiredTime = expiredAt
      ? expiredAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })
      : '—';

    const caption =
      `💳 *QRIS DONATION — NEXORA MD*\n\n` +
      `🕓 *Expires:* ${expiredTime} WIB\n` +
      `💸 *Admin fee:* ${fmtIDR(payment.fee)}\n` +
      `💰 *Total:* ${fmtIDR(payment.total_payment)}\n` +
      `📦 *Order ID:* #${payment.order_id}\n\n` +
      `Scan the QR above to pay. Thank you for supporting NEXORA MD 🙏`;

    try {
      await sock.sendMessage(m.from, {
        image: { url: `https://quickchart.io/qr?text=${encodeURIComponent(payment.payment_number)}` },
        caption,
      }, { quoted: m });
    } catch (err) {
      console.warn('[donate] QR image send failed, text fallback:', err.message);
      await m.reply(`${caption}\n\nPayment code: ${payment.payment_number}`);
    }
  },
};
