import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeContactQuote, buildAboutContextInfo, buildAboutButtons, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { config } from '../../../config/index.js';
import brand from '../../../config/brand.js';

/**
 * Contact Menu (id: 9)
 *
 * Primary tier uses sendButtonsCard with owner contact quote in contextInfo.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style) + owner contact badge in reply bar
 *   2 → nativeFlow card (image + buttons) + owner contact card in reply bar
 *   3 → text + externalAdReply banner + owner contact card in reply bar
 *   4 → guaranteed plain text + owner contact card in reply bar
 */
export const contactMenu = {
  id: 9,
  name: 'contact',
  description: 'nativeFlow card with image header + owner vCard contact badge in the reply bar',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData      = await imageManager.getMenuImage(9);
    const ownerNumber  = (config.owner[0] || '233597514499').replace(/[^0-9]/g, '');
    const ownerName    = menuData.ownerName || brand.creator || 'Owner';

    const menuText   = buildTextMenu(menuData);
    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    // Contact card in the reply bar — tappable vCard showing the owner's name.
    const contactQuote = buildFakeContactQuote({
      displayName: ownerName,
      phoneNumber: ownerNumber,
    });

    const contextInfo = {
      stanzaId:      contactQuote.key.id,
      participant:   contactQuote.key.participant,
      remoteJid:     contactQuote.key.remoteJid,
      quotedMessage: contactQuote.message,
    };

    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);

    // ── Tier 1: sendButtonsCard + contact badge in reply bar ───────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      menuText,
          footer:    footerText,
          title:     menuData.botName,
          subtitle:  `${menuData.totalCommands} commands • ${menuData.uptime}`,
          thumbnail,
          buttons: [
            { displayText: '📋 All Commands', id: `${menuData.prefix}menu all`, type: 1 },
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU contact] Tier 1 (sendButtonsCard + contact quote) failed, trying sendNativeFlow:', err.message);
      }
    }

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 2: nativeFlow card (image + buttons) + contact badge ──────────
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    menuText,
        footer:  footerText,
        title:   `✦ ${menuData.botName.toUpperCase()} ✦`,
        image:   imagePayload,
        buttons: [
          { text: `💬 Message ${ownerName}`, url:  `https://wa.me/${ownerNumber}` },
          { text: '📋 Command List',          id:   `${menuData.prefix}menulist` },
          { text: '📎 Copy Prefix',           copy: menuData.prefix },
          { text: '🤖 System Stats',           id:   `${menuData.prefix}menu aiDynamic` },
        ],
      }, { quoted: contactQuote });
    } catch (err) {
      console.warn('[MENU contact] Tier 2 (nativeFlow + image + contact quote) failed, trying adReply:', err.message);
    }

    // ── Tier 3: text + externalAdReply banner + contact badge ─────────────
    try {
      const adReply = {
        title:                 `✦ ${menuData.botName.toUpperCase()} ✦`,
        body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
        sourceUrl:             `https://wa.me/${ownerNumber}`,
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.buffer;
      } else if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
        adReply.originalImageUrl = imgData.source;
      }
      return await sock.sendMessage(m.from, {
        text:        menuText,
        contextInfo: { externalAdReply: adReply },
      }, { quoted: contactQuote });
    } catch (err) {
      console.warn('[MENU contact] Tier 3 (adReply + contact quote) failed, continuing to text:', err.message);
    }

    // ── Tier 4: guaranteed plain text + contact badge + banner ────────────
    const fallbackAdReply = {
      title:                 `✦ ${menuData.botName.toUpperCase()} ✦`,
      body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
      sourceUrl:             `https://wa.me/${ownerNumber}`,
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      fallbackAdReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      fallbackAdReply.thumbnailUrl = imgData.source;
      fallbackAdReply.originalImageUrl = imgData.source;
    }
    return await sock.sendMessage(m.from, {
      text:        menuText,
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: contactQuote });
  },
};

export default contactMenu;
