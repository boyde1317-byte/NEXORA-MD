/**
 * richCards — the unified-response "VIP rich card" applied to real surfaces.
 *
 * `vipRichKit` (r18) is the envelope that actually paints on device: a
 * botForwardedMessage carrying richResponseMessage + messageSecret, laid out
 * as sections of primitives (product card, markdown, 3PExt widget CTAs,
 * follow-up pills, hscroll shelves). `.vipcard` proves the envelope; this
 * module is where it earns its keep.
 *
 * WHAT FITS (display-only surfaces — nothing to tap into a command):
 *   • welcome / goodbye greetings  → product card + copy + channel chip
 *   • bot-intro card when added to a group
 *   • announcements, .about / .credits / status boards
 *   • rank / profile showcases (card + stats + shelf)
 *
 * WHAT DOES NOT FIT: surfaces where a tap must RUN a command — the menu
 * picker, `.shop` purchases, any select list. 3PExt CTAs and pills are
 * toast-only theater here (we are not a Meta AI endpoint), so those stay on
 * native-flow buttons, which do send the command back.
 */
import {
  sendUnifiedRich, productItemCard, markdownText, extWidget,
  followUpPills, singleSection, hScrollSection,
} from './vipRichKit.js';
import { ASSET_URLS } from '../assets/assetUrls.js';
import brand from '../../config/brand.js';

export const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326';
export const SUPPORT_URL = 'https://chat.whatsapp.com/GUgEw0Nd6CeEEmX7AQwnoQ';

/** Tap-through chips: the only CLICKABLE things inside a rich card. */
const chips = (items) => items.map((c) => ({
  url: c.url,
  title: c.title || c.displayName || c.url,
  displayName: c.displayName,
}));

/**
 * The greeting card: menu banner as the product image, the expanded greeting
 * copy as markdown, a CTA shelf and channel chips.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} input
 * @param {string} input.text          expanded greeting copy (mentions inline)
 * @param {boolean} input.isWelcome
 * @param {string} [input.groupName]
 * @param {number|string} [input.memberCount]
 * @param {string[]} [input.mentionedJid]
 * @param {object} [input.quoted]
 */
export async function sendGreetingRich(sock, jid, {
  text, isWelcome = true, groupName = 'this group',
  memberCount = null, mentionedJid = [], quoted = null,
} = {}) {
  const title = isWelcome ? `Welcome to ${groupName}` : `Goodbye from ${groupName}`;
  const badge = isWelcome ? `✅ Member #${memberCount ?? '—'}` : '👋 Until next time';

  return sendUnifiedRich(sock, jid, {
    disclaimer: isWelcome ? 'VIP Welcome' : 'VIP Goodbye',
    submessages: [{ messageType: 2, messageText: `👑 ${brand.name || 'NEXORA MD'}` }],
    mentionedJid,
    quoted,
    sections: [
      singleSection(productItemCard({
        title,
        brand: brand.name || 'NEXORA',
        price: badge,
        productUrl: CHANNEL_URL,
        imageUrl: isWelcome ? ASSET_URLS.menuBanner : (ASSET_URLS.goodbye || ASSET_URLS.menuBanner),
      })),
      singleSection(markdownText(text)),
      hScrollSection([
        extWidget({
          title: '⚡ Get started',
          ctas: [
            { label: 'Menu', toast: 'Type .menu', toolCallId: '01' },
            { label: 'Channel', toast: 'Open the channel', toolCallId: '02' },
            { label: 'Support', toast: 'Join the support group', toolCallId: '03' },
          ],
        }),
        ...followUpPills(['.menu', '.help owner', '.ping']),
      ]),
      singleSection(markdownText(
        `📢 *Channel:* ${CHANNEL_URL}\n💬 *Support:* ${SUPPORT_URL}`,
        chips([
          { url: CHANNEL_URL, displayName: '📢 Channel' },
          { url: SUPPORT_URL, displayName: '💬 Support' },
        ])
      )),
    ],
  });
}

/**
 * The intro card the bot posts when it is added to a group: same envelope,
 * group facts as the product card, the tour as markdown.
 */
export async function sendIntroRich(sock, jid, { text, groupName = 'this group', quoted = null } = {}) {
  return sendUnifiedRich(sock, jid, {
    disclaimer: 'NEXORA is here',
    submessages: [{ messageType: 2, messageText: `👑 ${brand.name || 'NEXORA MD'}` }],
    quoted,
    sections: [
      singleSection(productItemCard({
        title: `Now serving ${groupName}`,
        brand: brand.name || 'NEXORA',
        price: '✅ Online',
        productUrl: CHANNEL_URL,
        imageUrl: ASSET_URLS.menuBanner,
      })),
      singleSection(markdownText(text)),
      hScrollSection([
        extWidget({
          title: '⚡ Quick tour',
          ctas: [
            { label: 'Menu', toast: 'Type .menu', toolCallId: '01' },
            { label: 'Hub', toast: 'Type .groupsettings', toolCallId: '02' },
            { label: 'Remind', toast: 'Type .remind 30m <text>', toolCallId: '03' },
          ],
        }),
        ...followUpPills(['.menu', '.groupsettings', '.remind 30m tea']),
      ]),
    ],
  });
}

export { singleSection, hScrollSection, productItemCard, markdownText, extWidget, followUpPills };
export default sendGreetingRich;
