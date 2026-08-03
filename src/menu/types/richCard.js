import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

/**
 * Rich Card Menu (id: 15)
 *
 * Uses the fork's sendRichResponse API to render a native WA table
 * showing command categories and counts — a visually striking data-grid
 * layout that no other menu style produces.
 *
 * The richResponse message type supports:
 *   - Table rows with aligned columns (category | commands | count)
 *   - Text blocks with bold headers and accent symbols
 *   - Footer text with bot metadata
 *
 * Falls back through:
 *   1 → sendRichResponse (native WA table bubble)
 *   2 → sendInteractive with image header + embedded externalAdReply
 *       (double visual: interactive card + ad banner in one message)
 *   3 → text + externalAdReply banner
 *   4 → guaranteed plain text
 */
export const richCardMenu = {
  id: 15,
  name: 'richCard',
  description: 'Rich response table card — native WA table grid + interactive ad-reply overlay',
  supportedMessages: ['richResponseMessage', 'interactiveMessage', 'nativeFlowMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(15);
    const footerText = `${menuData.botName} \u2726 ${menuData.totalCommands} ${toSmallcaps('commands')} \u2726 ${menuData.uptime}`;

    // ── Build table data from categories ────────────────────────────────
    const categories = Object.keys(menuData.categories).sort();
    const tableRows = categories.map(cat => {
      const cmds = menuData.categories[cat];
      const top3 = cmds.slice(0, 3).map(c => c.name).join(', ');
      const overflow = cmds.length > 3 ? ` +${cmds.length - 3}` : '';
      return [cat, top3 + overflow, String(cmds.length)];
    });

    // ── Tier 1: Rich Response with native table ─────────────────────────
    // Uses the fork's richResponse message format — renders a structured
    // table bubble inside WhatsApp with aligned columns.
    try {
      const richContent = {
        headerText: `\u2726 ${toSmallcaps(menuData.botName + ' Command Matrix')} \u2726`,
        contentText: `${toSmallcaps('Total Commands')}: ${menuData.totalCommands}\n${toSmallcaps('Categories')}: ${categories.length}\n${toSmallcaps('Prefix')}: ${menuData.prefix}`,
        table: tableRows,
        footerText: toSmallcaps('Powered by') + ' ' + menuData.botName,
      };
      return await baileysBridge.sendRichResponse(sock, m.from, richContent, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU richCard] Tier 1 (richResponse table) failed, trying interactive card:', err.message);
    }

    // ── Tier 2: sendInteractive with image header + embedded externalAdReply ──
    // Double visual: interactive card with image header AND an externalAdReply
    // banner embedded inside the same message via contextInfo.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build the visual text body using the enhanced asciiBuilder
    const bodyLines = [];
    bodyLines.push(asciiBuilder.statRow('Total Commands', menuData.totalCommands));
    bodyLines.push(asciiBuilder.statRow('Categories', categories.length));
    bodyLines.push(asciiBuilder.statRow('Prefix', menuData.prefix));
    bodyLines.push(asciiBuilder.statRow('Uptime', menuData.uptime));
    bodyLines.push('');
    bodyLines.push(asciiBuilder.divider(toSmallcaps('Command Grid')));
    bodyLines.push('');

    for (const cat of categories) {
      const cmds = menuData.categories[cat];
      const top = cmds.slice(0, 4).map(c => c.name).join(' \u2502 ');
      const overflow = cmds.length > 4 ? ` \u2502 +${cmds.length - 4} ${toSmallcaps('more')}` : '';
      bodyLines.push(`\u2726 *${toSmallcaps(cat)}* \u2502 ${cmds.length}`);
      bodyLines.push(`  ${top}${overflow}`);
    }

    const bodyText = `\u2726 *${toSmallcaps(menuData.botName + ' Command Matrix')}* \u2726\n\n${bodyLines.join('\n')}`;

    // Build the embedded externalAdReply
    const adReply = {
      title: `\u2726 ${menuData.botName} \u2726`,
      body: `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Rich Card View')}`,
      sourceUrl: 'https://wa.me/233533416608',
      mediaType: 1,
      renderLargerThumbnail: true,
      showAdAttribution: false,
    };
    if (imgData.buffer) {
      adReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      adReply.thumbnailUrl = imgData.source;
      adReply.originalImageUrl = imgData.source;
    }

    const contextInfo = { externalAdReply: adReply };

    try {
      if (capabilities.nativeFlow) {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    bodyText,
          footer:  footerText,
          header:  {
            title: `\u2726 ${toSmallcaps('Command Matrix')} \u2726`,
            subtitle: `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${categories.length} ${toSmallcaps('categories')}`,
            ...(imagePayload ? { image: imagePayload } : {}),
          },
          buttons: [
            { name: 'quick_reply', params: { display_text: `\u{1F4CB} ${toSmallcaps('Browse Styles')}`, id: `${menuData.prefix}menulist` } },
            { name: 'quick_reply', params: { display_text: `\u{1F680} ${toSmallcaps('System Stats')}`, id: `${menuData.prefix}menu aiDynamic` } },
            { name: 'cta_url', params: { display_text: `\u{1F4AC} ${toSmallcaps('Contact Dev')}`, url: 'https://wa.me/233533416608' } },
          ],
          contextInfo,
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU richCard] Tier 2 (interactive + adReply) failed, trying text banner:', err.message);
    }

    // ── Tier 3: text + externalAdReply banner ────────────────────────────
    try {
      const fullText = bodyText + '\n\n' + buildTextMenu(menuData);
      return await sock.sendMessage(m.from, {
        text: fullText,
        contextInfo,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU richCard] Tier 3 (text + adReply) failed, escalating to plain text:', err.message);
    }

    // ── Tier 4: guaranteed plain text ────────────────────────────────────
    return await sock.sendMessage(m.from, {
      text: `\u2726 *${toSmallcaps(menuData.botName + ' Command Matrix')}* \u2726\n\n` + buildTextMenu(menuData),
    }, { quoted: menuData.audioQuote || m });
  },
};

export default richCardMenu;
