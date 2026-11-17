import { greetingBuilder } from '../greetingBuilder.js';
import { greetingConfig } from '../greetingConfig.js';
import { imageManager } from '../../images/imageManager.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import brand from '../../../config/brand.js';
import { sendGreetingRich } from '../../lib/richCards.js';

/**
 * Style 5 — Product card.
 *
 * The greeting is sent as a WhatsApp product card (`Message.productMessage`):
 * the menu banner as the product image, the greeting copy as the description,
 * and the group / member count in the body and footer. It is the same payload
 * shape `.product` sends, so it renders wherever that command renders.
 *
 * Both directions use it: a join reads as a membership pass, a leave as the
 * closing card. The @mention still travels in `mentions`, so the joiner (or
 * leaver) is pinged even though a product card has no inline mention markup.
 */

const PRODUCT_CURRENCY = (process.env.GREETING_CARD_CURRENCY || 'USD').toUpperCase();

/** The session's own user JID (strips the device suffix). */
const ownJid = (sock) => {
  const id = sock?.user?.id || '';
  return `${id.split(':')[0].replace(/@s\.whatsapp\.net$/, '')}@s.whatsapp.net`;
};

/**
 * The menu banner, as the product image.
 *
 * Same resolution order as the menu card: the brand image the menu itself
 * shows (imageManager style 5), then the static asset URL. Returns null when
 * neither loads — the card then renders without a picture rather than failing
 * the greeting.
 */
export async function resolveMenuBanner() {
  try {
    const img = await imageManager.getMenuImage(5);
    if (img?.buffer) return img.buffer;
    if (img?.source?.startsWith?.('http')) {
      const res = await fetch(img.source);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }
  } catch { /* fall through to the static asset */ }

  try {
    const url = ASSET_URLS.menuBanner || ASSET_URLS.thumbnail;
    if (url) {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }
  } catch { /* no banner — card without image */ }

  return null;
}

/**
 * Build the product-card payload for a greeting.
 *
 * Exported so the release gate can assert the shape without a socket.
 *
 * @param {object} input
 * @param {string} input.text        expanded greeting copy
 * @param {object} input.variables   { groupName, memberCount, userMention, … }
 * @param {boolean} input.isWelcome
 * @param {Buffer|null} [input.banner]
 * @param {object} [input.sock]      used for businessOwnerJid
 * @returns {object} sendMessage payload
 */
export function buildGreetingProductCard({ text, variables = {}, isWelcome = true, banner = null, sock = null } = {}) {
  const groupName = variables.groupName || 'this group';
  const title = isWelcome ? `Welcome to ${groupName}` : `Goodbye from ${groupName}`;
  const footer = isWelcome
    ? `Member #${variables.memberCount ?? '—'} • ${brand.name || 'NEXORA MD'}`
    : `Thanks for being here • ${brand.name || 'NEXORA MD'}`;

  return {
    product: {
      productId: `NX-${isWelcome ? 'WELCOME' : 'GOODBYE'}-${Date.now().toString(36).toUpperCase()}`,
      title: title.slice(0, 120),
      description: String(text || title).slice(0, 400),
      // A greeting is not for sale: the card reads as a free membership pass.
      priceAmount1000: 0,
      currencyCode: PRODUCT_CURRENCY,
      productImageCount: 1,
      firstImageId: 'IMG-MENU-BANNER',
    },
    businessOwnerJid: ownJid(sock),
    body: title.slice(0, 120),
    footer,
    ...(banner ? { image: banner } : {}),
    ...(variables.mentionJid ? { mentions: [variables.mentionJid] } : {}),
  };
}

export const welcome5 = {
  id: 5,
  name: 'Product Card (rich)',

  async render({ sock, jid, variables, isWelcome }) {
    const template = isWelcome
      ? greetingConfig.getWelcomeText()
      : greetingConfig.getGoodbyeText();
    const text = greetingBuilder.buildText(template, variables);

    // The unified-response envelope is the proven render path (it is what
    // `.vipcard` paints on device): product card with the menu banner, the
    // greeting copy as markdown, a CTA shelf and channel chips. When the
    // envelope is unavailable, fall back to the plain product card.
    try {
      await sendGreetingRich(sock, jid, {
        text,
        isWelcome,
        groupName: variables.groupName,
        memberCount: variables.memberCount,
        mentionedJid: variables.mentionJid ? [variables.mentionJid] : [],
      });
      return null; // already sent
    } catch (err) {
      console.warn('[GREETING] rich card failed, using product card:', err.message);
    }

    const banner = await resolveMenuBanner();
    return buildGreetingProductCard({ text, variables, isWelcome, banner, sock });
  },
};

export default welcome5;
