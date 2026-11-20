/**
 * tesbtn2.js — owner-only native-flow button test (second variant).
 *
 *   .tesbtn2   sends three test messages: plain native flow, fake
 *              catalog quote, and location-header + catalog quote
 *
 * Ported from the LUNA MD tesbtn.js plugin. The name is new (no live
 * NexoraFlex command is called tesbtn2), so nothing is shadowed.
 *
 * Differences from the LUNA MD original (luna-md/plugins/tesbtn.js):
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, owner gating via
 *     `permissions: { owner: true }`.
 *   - The hardcoded prefix '.' is now the ctx `prefix`; the menu rows
 *     point at commands NexoraFlex actually ships (.menu, .ping, .help,
 *     .owner, .sticker, .hd, .tts, .hidetag).
 *   - The hardcoded WhatsApp channel link is gone: the CTA button and
 *     the product URL now point at the NexoraFlex repo.
 *   - `OWNER_NUMBER` was `process.env.OWNER` falling back to an old
 *     Indonesian placeholder number; it is now moonson's number,
 *     233533416608.
 *   - Branding 'LUNA MD' -> 'NEXORA MD' throughout (footer, catalog
 *     ids, location header, product description).
 *   - The location header image URL is kept as-is (external asset with
 *     a try/catch fallback to no header); only the caption text changed.
 */
import sharp from 'sharp';

const FOOTER = 'NEXORA MD';
const OWNER_NUMBER = '233533416608';
const REPO_URL = 'https://github.com/boyde1317-byte/NexoraFlex';

const LOCATION_IMAGE_URL = 'https://cloud.yardansh.com/pOnMht.jpg';
const SUPPORT_URL = `https://wa.me/${OWNER_NUMBER.replace(/\D/g, '')}`;

// ============ BUILDERS ============

function buildMainSelect(prefix) {
  return JSON.stringify({
    title: '\u0000',
    sections: [
      {
        title: FOOTER,
        highlight_label: 'MAIN MENU',
        rows: [
          { title: 'All Menu', id: `${prefix}menu` },
          { title: 'Ping / Status', id: `${prefix}ping` },
          { title: 'Total Features', id: `${prefix}help` },
          { title: 'Owner', id: `${prefix}owner` },
        ],
      },
      {
        highlight_label: 'TOOLS',
        rows: [
          { title: 'Sticker', id: `${prefix}sticker` },
          { title: 'HD Image', id: `${prefix}hd` },
          { title: 'Text to Speech', id: `${prefix}tts` },
          { title: 'Hidetag', id: `${prefix}hidetag` },
        ],
      },
      {
        highlight_label: 'GROUP',
        rows: [
          { title: 'Hidetag', id: `${prefix}hidetag` },
          { title: 'Group Link', id: `${prefix}linkgrup` },
          { title: 'Admin List', id: `${prefix}listadmin` },
        ],
      },
    ],
    icon: 'DEFAULT',
  });
}

function buildInfoSelect(prefix) {
  return JSON.stringify({
    title: '\u0000',
    sections: [{
      title: FOOTER,
      highlight_label: 'INFORMATION',
      rows: [
        { title: 'Menu', id: `${prefix}menu` },
        { title: 'Owner', id: `${prefix}owner` },
        { title: 'Ping', id: `${prefix}ping` },
      ],
    }],
    icon: 'REVIEW',
  });
}

function buildCtaUrl() {
  return JSON.stringify({
    display_text: '\u0000',
    url: REPO_URL,
    merchant_url: REPO_URL,
    icon: 'PROMOTION',
  });
}

function buildMessageParams() {
  return JSON.stringify({
    limited_time_offer: {
      text: `${FOOTER} Support`,
      url: SUPPORT_URL,
      copy_code: 'Created by moonson',
      expiration_time: Date.now() + 60 * 60 * 1000,
    },
  });
}

function buildNativeButtons(prefix) {
  return [
    { name: '' },
    { name: 'single_select', buttonParamsJson: buildMainSelect(prefix) },
    { name: 'single_select', buttonParamsJson: buildInfoSelect(prefix) },
    { name: 'cta_url', buttonParamsJson: buildCtaUrl() },
  ];
}

function buildFakeCatalogQuote(thumbnailBytes) {
  const productId = '915302051';
  const product = {
    productId,
    title: FOOTER,
    description: 'Nexora • Menu Bot',
    retailerId: productId,
    url: REPO_URL,
    productImageCount: 1,
  };
  const productMessage = { product, businessOwnerJid: '0@s.whatsapp.net' };
  if (thumbnailBytes?.length) {
    productMessage.product.productImage = {
      mimetype: 'image/jpeg',
      jpegThumbnail: Buffer.isBuffer(thumbnailBytes) ? thumbnailBytes : Buffer.from(thumbnailBytes),
    };
  }
  return {
    key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast', id: `NEXORA-CATALOG-${Date.now()}` },
    message: { productMessage },
  };
}

async function buildLocationHeader() {
  try {
    const res = await fetch(LOCATION_IMAGE_URL, { signal: AbortSignal.timeout(10000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const thumb = await sharp(buf).resize(300, 300, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85, progressive: true }).toBuffer();
    return {
      header: {
        title: FOOTER,
        hasMediaAttachment: true,
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: FOOTER,
          address: 'Menu · Location Header',
          jpegThumbnail: thumb,
        },
      },
      thumb,
      b64: thumb.toString('base64'),
    };
  } catch {
    return { header: null, thumb: null, b64: '' };
  }
}

export default {
  name: 'tesbtn2',
  aliases: [],
  category: 'owner',
  description: 'Owner-only native-flow button test: plain flow, catalog quote, and location-header variants.',
  permissions: { owner: true },
  cooldown: 3000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    try {
      const jid = m.from;

      // MESSAGE 1 : PLAIN NATIVE FLOW
      const msg1 = {
        body: { text: '\u0000' },
        footer: { text: FOOTER },
        nativeFlowMessage: {
          buttons: buildNativeButtons(p),
          messageParamsJson: buildMessageParams(),
          messageVersion: 1,
        },
        contextInfo: { forwardingScore: 99, isForwarded: true },
      };

      await sock.relayMessage(jid, {
        viewOnceMessage: {
          message: { interactiveMessage: msg1 },
        },
      }, { participant: { jid: m.sender } });

      await new Promise((r) => setTimeout(r, 1000));

      // MESSAGE 2 : FAKE CATALOG QUOTE (without video so it stays stable)
      const msg2 = {
        body: { text: '\u0000' },
        footer: { text: FOOTER },
        nativeFlowMessage: {
          buttons: buildNativeButtons(p),
          messageParamsJson: buildMessageParams(),
          messageVersion: 1,
        },
        contextInfo: { forwardingScore: 99, isForwarded: true },
      };

      await sock.relayMessage(jid, {
        viewOnceMessage: {
          message: { interactiveMessage: msg2 },
        },
      }, { quoted: buildFakeCatalogQuote(null) });

      await new Promise((r) => setTimeout(r, 1000));

      // MESSAGE 3 : LOCATION HEADER + CATALOG
      const { header: locHeader, thumb: locThumb, b64 } = await buildLocationHeader();

      const msg3 = {
        body: { text: '\u0000' },
        footer: { text: FOOTER },
        nativeFlowMessage: {
          buttons: buildNativeButtons(p),
          messageParamsJson: buildMessageParams(),
          messageVersion: 1,
        },
        contextInfo: {
          forwardingScore: 99,
          isForwarded: true,
          stanzaId: m.key?.id || '',
          participant: m.key?.participant || '0@s.whatsapp.net',
          quotedMessage: b64 ? {
            orderMessage: { thumbnail: b64, itemCount: 1, message: 'NEXORA MD Location Header' },
          } : undefined,
          remoteJid: m.key?.remoteJid || '0@s.whatsapp.net',
        },
      };
      if (locHeader) msg3.header = locHeader;

      await sock.relayMessage(jid, {
        viewOnceMessage: {
          message: { interactiveMessage: msg3 },
        },
      }, { quoted: buildFakeCatalogQuote(locThumb) });
    } catch (err) {
      console.error('[tesbtn2]', err);
      await sock.sendMessage(m.from, { text: `❌ Error: ${err.message?.slice(0, 200)}` }, { quoted: m });
    }
  },
};
