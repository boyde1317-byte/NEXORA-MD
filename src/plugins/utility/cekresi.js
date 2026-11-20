/**
 * cekresi.js — .cekresi <tracking number> | .cekresi <courier> <tracking number>
 * — track an Indonesian parcel via BinderByte.
 *
 * Ported from LUNA MD plugins/tools-cekresi.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English
 *     (courier names are proper nouns and stay as-is).
 *   - The hardcoded BinderByte API key is GONE — replaced by the
 *     placeholder below. Fill it in (or wire it to env/config) before
 *     use; never commit a real key. Get a free key (500 req/week) at
 *     https://api.binderbyte.com.
 *   - The original's `conn.sendButton` courier picker does not exist
 *     in NexoraFlex, so the courier list is plain text: run
 *     `.cekresi <number>` to see it, then `.cekresi <courier> <number>`.
 *   - `m.chat` -> `m.from`; response fields are read defensively
 *     (the original crashed on `elres.data.summary` when the API
 *     returned an error shape).
 *   - No DB fields used.
 */

// ── BinderByte API key — FILL THIS IN, never commit a real key ─────────────
// Free key (500 requests/week) at https://api.binderbyte.com
const BINDERBYTE_API_KEY = 'PASTE_YOUR_BINDERBYTE_API_KEY_HERE';
// ─────────────────────────────────────────────────────────────────────────

const COURIERS = [
  { code: 'jne', name: 'JNE Express' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'jnt', name: "J&T Express" },
  { code: 'jnt_cargo', name: 'J&T Cargo' },
  { code: 'sicepat', name: 'SiCepat' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'anteraja', name: 'AnterAja' },
  { code: 'wahana', name: 'Wahana' },
  { code: 'ninja', name: 'Ninja Express' },
  { code: 'lion', name: 'Lion Parcel' },
  { code: 'pcp', name: 'PCP Express' },
  { code: 'jet', name: 'JET Express' },
  { code: 'rex', name: 'REX Express' },
  { code: 'first', name: 'First Logistics' },
  { code: 'ide', name: 'ID Express' },
  { code: 'spx', name: 'Shopee Express' },
  { code: 'kgx', name: 'KGXpress' },
  { code: 'sap', name: 'SAP Express' },
  { code: 'rpx', name: 'RPX' },
  { code: 'lex', name: 'Lazada Express' },
  { code: 'indah_cargo', name: 'Indah Cargo' },
  { code: 'dakota', name: 'Dakota Cargo' },
  { code: 'kurir_tokopedia', name: 'Kurir Tokopedia' },
];

export default {
  name: 'cekresi',
  category: 'utility',
  description: 'Track an Indonesian parcel. Usage: .cekresi <number> or .cekresi <courier> <number>',
  cooldown: 5000,
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    if (!args[0]) {
      return m.reply(`Enter the tracking number\nExample:\n${p}cekresi 81902xxxx`);
    }

    if (args.length === 1) {
      const resi = args[0];
      const rows = COURIERS.map((v) => `• ${v.name} — \`${p}cekresi ${v.code} ${resi}\``).join('\n');
      return m.reply(`📦 *TRACK PACKAGE*\n\nTracking Number: *${resi}*\n\nChoose a courier:\n${rows}`);
    }

    const courier = args[0].toLowerCase();
    const resi = args[1];
    if (!COURIERS.find((v) => v.code === courier)) {
      return m.reply.warn(`Courier *${courier}* is not available.\nRun \`${p}cekresi ${resi || '<number>'}\` to see the list.`);
    }
    if (!resi) {
      return m.reply(`Enter the tracking number\nExample:\n${p}cekresi ${courier} 81902xxxx`);
    }

    if (!BINDERBYTE_API_KEY || BINDERBYTE_API_KEY.startsWith('PASTE_YOUR_')) {
      return m.reply.error('Parcel tracking is not set up yet — the owner still needs to add the BinderByte API key.');
    }

    let elres;
    try {
      const res = await fetch(
        `https://api.binderbyte.com/v1/track?api_key=${encodeURIComponent(BINDERBYTE_API_KEY)}&courier=${encodeURIComponent(courier)}&awb=${encodeURIComponent(resi)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      elres = await res.json();
    } catch (err) {
      console.warn('[cekresi] BinderByte request failed:', err.message);
      return m.reply.error('Tracking number not found or API error.');
    }

    if (!elres?.data?.summary) {
      return m.reply.error(`Tracking failed: ${elres?.message || 'no data returned'}. Check the number and courier.`);
    }

    const s = elres.data.summary;
    const d = elres.data.detail || {};
    const history = Array.isArray(elres.data.history) ? elres.data.history : [];

    let teks = `📦 *TRACKING NUMBER*\n\n`;
    teks += `Status: ${elres.status ?? '-'}\n`;
    teks += `Message: ${elres.message ?? '-'}\n\n`;
    teks += `*Summary*\n`;
    teks += `AWB: ${s.awb ?? '-'}\n`;
    teks += `Courier: ${s.courier ?? '-'}\n`;
    teks += `Service: ${s.service ?? '-'}\n`;
    teks += `Status: ${s.status ?? '-'}\n`;
    teks += `Date: ${s.date ?? '-'}\n`;
    teks += `Description: ${s.desc ?? '-'}\n`;
    teks += `Cost: ${s.amount ?? '-'}\n`;
    teks += `Weight: ${s.weight ?? '-'}\n\n`;
    teks += `*Details*\n`;
    teks += `Origin: ${d.origin ?? '-'}\n`;
    teks += `Destination: ${d.destination ?? '-'}\n`;
    teks += `Sender: ${d.shipper ?? '-'}\n`;
    teks += `Recipient: ${d.receiver ?? '-'}\n\n`;
    teks += `*History*\n`;
    history.forEach((v, i) => {
      teks += `${i + 1}. ${v.date ?? '-'}\n   ${v.desc ?? '-'}\n   ${v.location ?? '-'}\n\n`;
    });

    await m.reply(teks.trim());
  },
};
