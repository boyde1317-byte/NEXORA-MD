import { getGreeting, divider } from '../formatter.js';
import { db } from '../../database/db.js';
import { imageManager } from '../../images/imageManager.js';
import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { buildFakeImageQuote, buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * AI-Dynamic Menu (id: 12) — .about-style rendering.
 *
 * Primary tier uses sendButtonsCard (thumbnail header + product catalog quote
 * + pill buttons), matching the .about command's visual style.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + pill buttons)
 *   2 → sendInteractive with image header + subtitle + embedded adReply
 *   3 → nativeFlow interactive card with image header + buttons
 *   4 → text + externalAdReply banner
 */
const THEMES = [
  { name: 'COSMIC SLATE',    accent: '\u2726' },
  { name: 'CYBERPUNK NEON',  accent: '\u26A1' },
  { name: 'MATRIX DIGITAL',  accent: '\u25C8' },
  { name: 'AURORA FLOW',     accent: '\u2744' },
  { name: 'PHANTOM CORE',    accent: '\u2764' },
];

export const aiDynamicMenu = {
  id: 12,
  name: 'aiDynamic',
  description: 'AI-Dynamic system dashboard — .about-style buttons card with auto-theming and stats',
  supportedMessages: ['buttonsMessage', 'interactiveMessage', 'nativeFlowMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(12);
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

    // Compute dynamic command ranking from database metrics
    const stats = db.data.stats?.commandsUsed || {};
    const ranking = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let rankingText = '';
    if (ranking.length > 0) {
      const maxCount = ranking[0][1] || 1;
      rankingText = ranking.map(([name, count], i) => {
        const bar = asciiBuilder.progressBar(Math.round((count / maxCount) * 100), 10, '');
        return `  ${i + 1}. \`${name}\`\n     ${bar}`;
      }).join('\n');
    } else {
      rankingText = '  _No commands recorded yet._';
    }

    const userDb = db.getUser(m.sender);
    const isGroup = m.isGroup;
    const groupDb = isGroup ? db.getGroup(m.from) : null;

    const memUsage = process.memoryUsage();
    const memPercent = Math.min(100, Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100));
    const pingMs = 80 + Math.floor(Math.random() * 60);
    const healthPercent = Math.max(20, Math.min(100, 100 - Math.floor(pingMs / 4)));

    let text = `${theme.accent} *${toSmallcaps(theme.name)}* ${theme.accent}\n`;
    text += `_${getGreeting()}, @${m.senderNumber}!_\n`;
    text += `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

    text += `\u250C\u2500 *${toSmallcaps('System Health')}*\n`;
    text += `\u2502 ${asciiBuilder.progressBar(healthPercent, 14, 'Load')}\n`;
    text += `\u2502 ${asciiBuilder.progressBar(memPercent, 14, 'RAM')}\n`;
    text += `\u2502 ${asciiBuilder.statRow('Latency', `~${pingMs}ms`)}\n`;
    text += `\u2502 ${asciiBuilder.statRow('Uptime', menuData.uptime)}\n`;
    text += `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

    text += `\u250C\u2500 *${toSmallcaps('Command Rankings')}*\n`;
    text += `${rankingText.split('\n').map(l => l ? `\u2502 ${l}` : '\u2502').join('\n')}\n`;
    text += `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

    text += `\u250C\u2500 *${toSmallcaps('User Context')}*\n`;
    text += `\u2502 ${asciiBuilder.statRow('Rank', userDb?.premium ? '\u2B50 Premium' : 'Standard')}\n`;
    if (isGroup) {
      text += `\u2502 ${asciiBuilder.statRow('Group', groupDb?.mute ? 'Muted' : 'Active')}\n`;
    }
    text += `\u2502 ${asciiBuilder.statRow('Commands', menuData.totalCommands)}\n`;
    text += `\u2502 ${asciiBuilder.statRow('Prefix', menuData.prefix)}\n`;
    text += `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

    text += `\u250C\u2500 *${toSmallcaps('Available Modules')}*\n`;
    const categories = Object.keys(menuData.categories).sort();
    for (const cat of categories) {
      const cmdCount = menuData.categories[cat].length;
      const list = menuData.categories[cat].slice(0, 4).map(c => `\`${c.name}\``).join(', ');
      const overflow = menuData.categories[cat].length > 4 ? ` +${menuData.categories[cat].length - 4}` : '';
      text += `\u2502 \u2726 *${toSmallcaps(cat)}* (${cmdCount})\n\u2502   ${list}${overflow}\n`;
    }
    text += `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n`;

    text += `${asciiBuilder.badge('Status', 'OPTIMAL')}  `;
    text += `${asciiBuilder.badge('Engine', 'Baileys')}  `;
    text += `${asciiBuilder.badge('Theme', theme.name)}\n`;

    text += `\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    text += `${toSmallcaps('Powered by')} \u2726 ${menuData.botName} \u2726`;

    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    const footerText = `${menuData.botName} \u2502 ${menuData.totalCommands} commands \u2502 ${theme.name}`;

    // Build embedded externalAdReply for fallback tiers
    const adReply = {
      title:                 menuData.botName,
      body:                  `${menuData.totalCommands} commands \u2502 ${theme.name}`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      adReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      adReply.thumbnailUrl = imgData.source;
      adReply.originalImageUrl = imgData.source;
    }

    // ── Tier 1: sendButtonsCard (.about style) ─────────────────────────────
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx  = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer, mentionedJid: m.sender });
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      text,
          footer:    footerText,
          title:     menuData.botName,
          subtitle:  `${menuData.totalCommands} commands \u2502 ${theme.name}`,
          thumbnail,
          buttons: [
            { displayText: '\u{1F4CB} All Commands', id: `${menuData.prefix}menu all`, type: 1 },
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: aboutCtx,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU aiDynamic] Tier 1 (sendButtonsCard) failed, trying sendInteractive:', err.message);
      }
    }

    // ── Tier 2: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive && imagePayload) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    text,
          footer:  footerText,
          header:  {
            title:    `${theme.accent} ${toSmallcaps(theme.name)} ${theme.accent}`,
            subtitle: `${toSmallcaps('Dynamic Dashboard')} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`,
            image:    imagePayload,
          },
          buttons: [
            { name: 'quick_reply', params: { display_text: `\u{1F4CB} ${toSmallcaps('Browse Menu Styles')}`, id: `${menuData.prefix}menulist` } },
            { name: 'quick_reply', params: { display_text: `\u{1F3D1} ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` } },
            { name: 'cta_url',    params: { display_text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,   url: 'https://wa.me/233533416608' } },
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU aiDynamic] Tier 2 (sendInteractive + adReply) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 3: nativeFlow interactive card with buttons ───────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    text,
          footer:  footerText,
          image:   imagePayload,
          buttons: [
            { text: `\u{1F4CB} ${toSmallcaps('Browse Menu Styles')}`, id: `${menuData.prefix}menulist` },
            { text: `\u{1F3D1} ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` },
            { text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,   url: 'https://wa.me/233533416608' },
          ],
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU aiDynamic] Tier 3 (nativeFlow) failed, trying adReply:', err.message);
      }
    }

    // ── Tier 4: text + externalAdReply banner ─────────────────────────────
    return await sock.sendMessage(m.from, {
      text,
      mentions:    [m.sender],
      contextInfo: { externalAdReply: adReply },
    }, { quoted: buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined }) });
  }
};

export default aiDynamicMenu;
