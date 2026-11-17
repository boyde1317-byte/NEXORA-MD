/**
 * vipSurfaces — the VIP unified-response card (.vipcard envelope) on the
 * commands where it fits.
 *
 * The envelope is display-only: product card, markdown, 3PExt CTA shelf and
 * pills. CTA taps show a toast rather than running a command (we are not a
 * Meta AI endpoint), so it is applied to commands whose whole job is to SHOW
 * something: `.stats`, `.about`, `.credits`. Commands where the point is to
 * tap through and run something — the menu picker, `.shop`, anything with a
 * select list — keep their native-flow buttons.
 *
 * Every builder throws on failure; callers keep their existing card as the
 * fallback so a surface never goes silent.
 */
import {
  sendUnifiedRich, productItemCard, markdownText, extWidget,
  followUpPills, singleSection, hScrollSection,
} from './vipRichKit.js';
import { ASSET_URLS } from '../assets/assetUrls.js';
import brand from '../../config/brand.js';

export const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326';
export const SUPPORT_URL = 'https://chat.whatsapp.com/GUgEw0Nd6CeEEmX7AQwnoQ';
export const GITHUB_URL = 'https://github.com/boyde1317-byte/NexoraFlex';

const BOT = brand.name || 'NEXORA MD';

const chips = (items) => items.map((c) => ({
  url: c.url,
  title: c.title || c.displayName || c.url,
  displayName: c.displayName,
}));

/** Shared tail: channel + support chips, used by every surface below. */
const linkSection = () => singleSection(markdownText(
  `📢 *Channel:* ${CHANNEL_URL}\n💬 *Support:* ${SUPPORT_URL}`,
  chips([
    { url: CHANNEL_URL, displayName: '📢 Channel' },
    { url: SUPPORT_URL, displayName: '💬 Support' },
  ])
));

const startShelf = (p) => hScrollSection([
  extWidget({
    title: '⚡ Try next',
    ctas: [
      { label: 'Menu', toast: `Type ${p}menu`, toolCallId: '01' },
      { label: 'Stats', toast: `Type ${p}stats`, toolCallId: '02' },
      { label: 'Support', toast: 'Join the support group', toolCallId: '03' },
    ],
  }),
  ...followUpPills([`${p}menu`, `${p}stats`, `${p}ping`]),
]);

/**
 * `.stats` — headline numbers as the product card, the metric list as
 * markdown, then the CTA shelf and links.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} input
 * @param {string} input.markdown   already-formatted metrics block
 * @param {string} [input.headline] product-card price line
 * @param {string} [input.title]
 * @param {object} [input.quoted]
 */
export async function sendStatsRich(sock, jid, { markdown, headline = '📊 Live', title = `${BOT} Statistics`, quoted = null } = {}) {
  return sendUnifiedRich(sock, jid, {
    disclaimer: 'Stats',
    submessages: [{ messageType: 2, messageText: `📊 ${title}` }],
    quoted,
    sections: [
      singleSection(productItemCard({
        title,
        brand: BOT,
        price: headline,
        productUrl: CHANNEL_URL,
        imageUrl: ASSET_URLS.menuBanner,
      })),
      singleSection(markdownText(markdown)),
      startShelf('.'),
      linkSection(),
    ],
  });
}

/**
 * `.about` — the bot as a "product" (status + version), the profile text as
 * markdown, then shelf and links.
 */
export async function sendAboutRich(sock, jid, { markdown, body, footer, status = '🟢 Online', quoted = null } = {}) {
  return sendUnifiedRich(sock, jid, {
    disclaimer: 'About',
    submessages: [{ messageType: 2, messageText: `ℹ️ ${body || BOT}` }],
    quoted,
    sections: [
      singleSection(productItemCard({
        title: body || BOT,
        brand: BOT,
        price: status,
        salePrice: footer ? String(footer).slice(0, 40) : undefined,
        productUrl: GITHUB_URL,
        imageUrl: ASSET_URLS.thumbnail,
      })),
      singleSection(markdownText(markdown)),
      startShelf('.'),
      linkSection(),
    ],
  });
}

/**
 * `.credits` — the people behind the bot as the card, their roles as
 * markdown, with the repo as the tap-through chip.
 */
export async function sendCreditsRich(sock, jid, { markdown, title = 'Credits', subtitle = 'The people behind the bot', quoted = null } = {}) {
  return sendUnifiedRich(sock, jid, {
    disclaimer: 'Credits',
    submessages: [{ messageType: 2, messageText: `💚 ${title}` }],
    quoted,
    sections: [
      singleSection(productItemCard({
        title,
        brand: BOT,
        price: `by ${(brand.creator || 'Moonson').split('/')[0].trim()}`,
        productUrl: GITHUB_URL,
        imageUrl: ASSET_URLS.thumbnail,
      })),
      singleSection(markdownText(markdown)),
      singleSection(markdownText(
        `⭐ *Source:* ${GITHUB_URL}`,
        chips([{ url: GITHUB_URL, displayName: '⭐ GitHub' }])
      )),
    ],
  });
}

export default sendStatsRich;
