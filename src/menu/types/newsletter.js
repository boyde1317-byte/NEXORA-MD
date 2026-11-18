import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { newsletterManager } from '../../newsletter/newsletterManager.js';
import brand from '../../../config/brand.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeNewsletterQuote } from '../../lib/waUtils.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildPillButton, buildPillUrlButton, buildNavigationButton, buildCtaReplyButton, buildCtaUrlButton, buildCtaCopyButton } from './buttonsCard.js';

// Display name: the styled brand name when the bot runs under the brand
// name, plain otherwise — a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/**
 * Newsletter Menu (id: 7)
 *
 * Uses sendCtaCard (interactiveMessage with CTA rows) as Tier 1 for universal
 * WhatsApp client compatibility. A fake newsletterAdminInviteMessage quote
 * is used for the reply bar (channel invite card). The native newsletter
 * admin invite is retained as Tier 2 when a channelJid is configured.
 *
 * Tiers:
 *   1 → sendCtaCard with image header + newsletter quote + adReply
 *   2 → Native newsletter admin invite card (requires channelJid)
 *   3 → imageMessage with caption
 *   4 → Guaranteed plain text
 */
export const newsletterMenu = {
  id: 7,
  name: 'newsletter',
  description: 'Channel-style CTA card with newsletter quote + optional native invite fallback',
  supportedMessages: ['interactiveMessage', 'buttonsMessage', 'newsletterAdminInviteMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = (await imageManager.getMenuImage(7).catch(() => null)) || {};

    const textContent = buildTextMenu(menuData);
    const bodyText =
      `` +
      `*${toSmallcaps('System Brief')}*\n` +
      `\u2022 *${toSmallcaps('Status')}:* Optimal\n` +
      `\u2022 *${toSmallcaps('Framework')}:* Baileys\n` +
      `\u2022 *${toSmallcaps('Total Commands')}:* ${menuData.totalCommands}\n` +
      `\u2022 *${toSmallcaps('System Uptime')}:* ${menuData.uptime}\n\n` +
      textContent;

    const footerText = `Fun All Day 🪸`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build fake newsletter quote for reply bar
    const newsletterQuote = buildFakeNewsletterQuote({
      newsletterJid:   menuData.channelJid || '120363406397452589@newsletter',
      newsletterName:  `${brand.name} Updates`,
      caption:         `Moonson made this with \u2665\uFE0F`,
    });

    // Build embedded externalAdReply
    const adReply = {
      title:                 `${displayName(menuData.botName)}`,
      body:                  ``,
      sourceUrl:             'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      adReply.thumbnail = imgData.thumbBuffer;
    } else if (imgData.source?.startsWith('http')) {
      adReply.thumbnailUrl = imgData.source;
      adReply.originalImageUrl = imgData.source;
    }

    // ── Tier 1: sendButtonsCard with image header + newsletter quote ──────
    if (imagePayload) {
      try {
        return await baileysBridge.sendCtaCard(sock, m.from, {
          dim: true,
          body:       bodyText,
          footer:     footerText,
          title:      `Feel The Breeze 🌬`,
          subtitle:   `${toSmallcaps('Commands')}: ${menuData.totalCommands} \u2502 ${toSmallcaps('Uptime')}: ${menuData.uptime}`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton(` ${toSmallcaps('Ping Speed')}`,        `${menuData.prefix}ping`),
            buildPillButton(` ${toSmallcaps('Command List')}`,       `${menuData.prefix}help`),
            buildPillButton(`${toSmallcaps('System Stats')}`,       `${menuData.prefix}menu aiDynamic`),
            buildCtaReplyButton(`\u2630 ${toSmallcaps('All Commands')}`, `${menuData.prefix}help`),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: newsletterQuote });
      } catch (err) {
        console.warn('[MENU newsletter] Tier 1 (sendButtonsCard + newsletter quote) failed, trying native invite:', err.message);
      }
    }

    // ── Tier 2: Native newsletter admin invite (requires channelJid) ──────
    const hasChannel = !!menuData.channelJid;
    if (hasChannel) {
      try {
        // Send image banner first — newsletter invite has no image field.
        if (imgData.buffer) {
          await sock.sendMessage(m.from, {
            image:    imgData.buffer,
            mimetype: imgData.mimetype,
            caption:  `\u{1F4E1} ${displayName(menuData.botName)} \u2014 ${toSmallcaps('Broadcasting now')}`,
          }, { quoted: newsletterQuote });
        } else if (imgData.source?.startsWith('http')) {
          await sock.sendMessage(m.from, {
            image:   { url: imgData.source },
            caption: `\u{1F4E1} ${displayName(menuData.botName)} \u2014 ${toSmallcaps('Broadcasting now')}`,
          }, { quoted: newsletterQuote });
        }

        return await newsletterManager.sendNewsletterInvite(sock, m.from, {
          name:              `${brand.name} Updates`,
          caption:            bodyText,
          newsletterJid:     menuData.channelJid,
          forwardingEnabled: true,
        }, { quoted: newsletterQuote });
      } catch (err) {
        console.warn('[MENU newsletter] Tier 2 (native newsletter invite) failed:', err.message);
      }
    }

    // ── Tier 3: imageMessage with caption ─────────────────────────────────
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:    imgData.buffer,
          mimetype: imgData.mimetype,
          caption:   bodyText,
        }, { quoted: newsletterQuote });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:   { url: imgData.source },
          caption:  bodyText,
        }, { quoted: newsletterQuote });
      }
    } catch (err) {
      console.warn('[MENU newsletter] Tier 3 (imageMessage) failed, continuing to text:', err.message);
    }

    // ── Tier 4: Guaranteed plain text + newsletter quote + banner ──────────
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: newsletterQuote });
  },
};

export default newsletterMenu;
