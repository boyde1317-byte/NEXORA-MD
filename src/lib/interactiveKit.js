/**
 * @file src/lib/interactiveKit.js
 * Context-aware interactive message dispatcher for NEXORA-MD.
 *
 * Maps task semantics → correct fork button type, then dispatches via
 * baileysBridge.sendNativeFlow with a graceful plain-text fallback.
 *
 * BUTTON TYPE SEMANTICS (fork's prepareNativeFlowButtons):
 *   quick_reply  { text, id }        → run a bot command on tap
 *   cta_url      { text, url }       → open an external URL
 *   cta_copy     { text, copy }      → copy a value to clipboard
 *   cta_call     { text, call }      → dial a phone number
 *   single_select{ text, sections }  → open a list picker / dropdown
 *   bottom_sheet  optionText/optionTitle props on sendNativeFlow →
 *                                      collapse all rows into a WA modal sheet
 *
 * RICH CONTENT (botForwardedMessage / richResponseMessage):
 *   richTableCard → native WA table bubble (falls back to ASCII)
 *   richCodeCard  → syntax-highlighted code block (falls back to cta_copy card)
 *
 * Every exported function falls back to sock.sendMessage({ text }) so commands
 * never go silent even on clients that don't support interactive messages.
 *
 * Usage in a plugin:
 *   import { mixedCard, selectMenu, richTableCard, copyResultCard } from '../lib/interactiveKit.js'
 */

import capabilities from '../core/capabilities.js';
import { baileysBridge } from '../core/baileysBridge.js';
import { buildAdReplyContext } from './waUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** WA nativeFlow allows a max of 10 buttons per message. */
const cap = (arr) => arr.slice(0, 10);

/**
 * Smart dispatch — tries nativeFlow first, then plain text.
 * @param {import('baileys').WASocket} sock
 * @param {string} jid
 * @param {object} payload  Passed directly to baileysBridge.sendNativeFlow
 * @param {object} [opts]
 */
async function _send(sock, jid, payload, opts = {}) {
  if (!capabilities.nativeFlow) {
    return sock.sendMessage(jid, { text: payload.text || '' }, opts);
  }
  try {
    return await baileysBridge.sendNativeFlow(sock, jid, payload, opts);
  } catch (err) {
    console.warn('[interactiveKit] nativeFlow failed, plain-text fallback:', err.message);
    return sock.sendMessage(jid, { text: payload.text || '' }, opts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ACTION CARD — quick_reply buttons that trigger bot commands
//    Best for: command navigations, post-result follow-ups, confirmations.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a nativeFlow card with quick_reply buttons.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string, title?: string, image?: Buffer }} content
 * @param {Array<{ label: string, cmd: string }>} actions
 * @param {object} [opts]
 *
 * @example
 * await actionCard(sock, m.from, { text: 'Daily claimed!', footer: 'NEXORA' }, [
 *   { label: '💰 Check Balance', cmd: `${prefix}balance` },
 *   { label: '🏆 Leaderboard',   cmd: `${prefix}top` },
 * ], { quoted: m });
 */
export async function actionCard(sock, jid, content, actions, opts = {}) {
  const buttons = cap(actions.map(a => ({ text: a.label, id: a.cmd })));
  return _send(sock, jid, { ...content, buttons }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. ACTION CARD + AD REPLY — quick_reply buttons AND an externalAdReply
//     thumbnail banner in a single message.
//     `sendNativeFlow`'s declarative buttons have no contextInfo passthrough
//     (see baileysBridge.sendNativeFlow / menu/types/nativeFlow.js, which
//     treats nativeFlow-buttons and adReply-banner as separate fallback
//     tiers, never combined). `sendInteractive` builds the interactiveMessage
//     proto by hand and DOES expose `contextInfo` (supports externalAdReply)
//     alongside real nativeFlowMessage buttons, so this goes through that
//     path instead — one relayMessage call, one message on screen.
//     Falls back to a plain adReply + quick_reply text message if the
//     interactive proto path fails on the client.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string, title?: string }} content
 * @param {Array<{ label: string, cmd: string }>} actions
 * @param {import('./waUtils.js').AdReplyOpts} ad   externalAdReply card (title/body/thumbnail)
 * @param {object} [opts]
 *
 * @example
 * await actionCardWithAd(sock, m.from, { text: 'Public mode enabled.', footer: 'Setting saved' }, [
 *   { label: '🔒 Switch to Self', cmd: `${prefix}self` },
 * ], { title: '🌐 PUBLIC MODE', body: 'Setting saved', thumbnail }, { quoted: m });
 */
export async function actionCardWithAd(sock, jid, content, actions, ad, opts = {}) {
  const nativeButtons = cap(actions).map(a => ({
    name:   'quick_reply',
    params: { display_text: a.label, id: a.cmd },
  }));
  const contextInfo = buildAdReplyContext(ad);

  try {
    return await baileysBridge.sendInteractive(sock, jid, {
      body:    content.text,
      footer:  content.footer || '',
      header:  content.title ? { title: content.title } : undefined,
      buttons: nativeButtons,
      contextInfo,
    }, opts);
  } catch (err) {
    console.warn('[interactiveKit.actionCardWithAd] sendInteractive failed, adReply+text fallback:', err.message);
    // Fallback: at least keep the ad banner, drop to plain-text buttons list
    // (single message; loses tappable buttons but not the thumbnail card).
    const buttonList = actions.map(a => `• ${a.label}: ${a.cmd}`).join('\n');
    return sock.sendMessage(jid, {
      text: `${content.text}${buttonList ? `\n\n${buttonList}` : ''}`,
      contextInfo,
    }, opts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LINK CARD — cta_url buttons for external URLs
//    Best for: dev contact, channel links, docs, source repos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string, title?: string }} content
 * @param {Array<{ label: string, url: string }>} links
 * @param {object} [opts]
 */
export async function linkCard(sock, jid, content, links, opts = {}) {
  const buttons = cap(links.map(l => ({ text: l.label, url: l.url })));
  return _send(sock, jid, { ...content, buttons }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. COPY RESULT CARD — cta_copy button for copyable outputs
//    Best for: base64 results, generated codes, session strings, API outputs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string, copyLabel?: string, copyValue: string, extraButtons?: [] }} content
 * @param {object} [opts]
 *
 * @example
 * await copyResultCard(sock, m.from, {
 *   text:       'dGhpcyBpcyBiYXNlNjQ=',
 *   copyLabel:  '📋 Copy Base64',
 *   copyValue:  'dGhpcyBpcyBiYXNlNjQ=',
 *   footer:     'BASE64 ENCODED',
 *   extraButtons: [{ text: '🔁 Decode', id: `${prefix}base64 decode <result>` }],
 * }, { quoted: m });
 */
export async function copyResultCard(sock, jid, { text, footer, copyLabel = '📋 Copy Result', copyValue, extraButtons = [] }, opts = {}) {
  const buttons = cap([
    { text: copyLabel, copy: copyValue },
    ...extraButtons,
  ]);
  return _send(sock, jid, { text, footer, buttons }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MIXED CARD — combine quick_reply / cta_url / cta_copy / cta_call freely
//    Best for: about page, version info, multi-purpose command results.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string, title?: string, image?: Buffer }} content
 * @param {Array<
 *   | { kind: 'action', label: string, cmd: string }
 *   | { kind: 'url',    label: string, url: string }
 *   | { kind: 'copy',   label: string, value: string }
 *   | { kind: 'call',   label: string, phone: string }
 * >} specs
 * @param {object} [opts]
 *
 * @example
 * await mixedCard(sock, m.from, { text: body }, [
 *   { kind: 'url',    label: '💬 Contact Dev',  url:   'https://wa.me/233533416608' },
 *   { kind: 'copy',   label: '📋 Copy Prefix',  value: '.' },
 *   { kind: 'action', label: '🤖 System Stats', cmd:   '.menu aiDynamic' },
 * ], { quoted: m });
 */
export async function mixedCard(sock, jid, content, specs, opts = {}) {
  const buttons = cap(specs.map(s => {
    switch (s.kind) {
      case 'url':  return { text: s.label, url:  s.url };
      case 'copy': return { text: s.label, copy: s.value };
      case 'call': return { text: s.label, call: s.phone };
      default:     return { text: s.label, id:   s.cmd };
    }
  }));
  return _send(sock, jid, { ...content, buttons }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SINGLE-SELECT MENU — list picker / dropdown
//    Best for: category pickers, command browsers, multi-option settings,
//              lookup type selection (e.g. checkwa: check ban / check status).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string, title?: string }} content
 * @param {string} pickerLabel           Label on the list-opener button
 * @param {Array<{
 *   title: string,
 *   rows: Array<{ id: string, title: string, description?: string }>
 * }>} sections
 * @param {Array<
 *   | { kind: 'action', label: string, cmd: string }
 *   | { kind: 'url',    label: string, url: string }
 * >} [sideButtons]   Additional quick_reply / url buttons alongside the picker
 * @param {object} [opts]
 *
 * @example
 * await selectMenu(sock, m.from, { text: 'Choose an action:' }, '⚙️ Options', [
 *   { title: 'Anti-Link', rows: [
 *     { id: '.antilink on',  title: '✅ Enable',  description: 'Block all links' },
 *     { id: '.antilink off', title: '❌ Disable', description: 'Allow links' },
 *   ]}
 * ], [], { quoted: m });
 */
export async function selectMenu(sock, jid, content, pickerLabel, sections, sideButtons = [], opts = {}) {
  const buttons = cap([
    { text: pickerLabel, sections },
    ...sideButtons.map(s => s.kind === 'url'
      ? { text: s.label, url: s.url }
      : { text: s.label, id: s.cmd }),
  ]);
  return _send(sock, jid, { ...content, buttons }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. BOTTOM SHEET CARD — collapses rows into a native WA modal sheet
//    Best for: large command lists, settings panels, bulk item selections.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ text: string, footer?: string }} content
 * @param {string} sheetButtonLabel   Text on the toggle button that opens the sheet
 * @param {string} sheetTitle         Title shown at the top of the open sheet modal
 * @param {Array<{ text: string, id?: string, url?: string, copy?: string }>} sheetRows
 * @param {object} [opts]
 *
 * @example
 * await bottomSheetCard(sock, m.from, { text: body }, '📋 Browse Commands', 'NEXORA COMMANDS', [
 *   { text: 'Ping Bot',     id:  '.ping' },
 *   { text: 'System Stats', id:  '.menu aiDynamic' },
 *   { text: 'Dev Contact',  url: 'https://wa.me/233533416608' },
 * ], { quoted: m });
 */
export async function bottomSheetCard(sock, jid, content, sheetButtonLabel, sheetTitle, sheetRows, opts = {}) {
  const buttons = cap(sheetRows);
  return _send(sock, jid, {
    ...content,
    buttons,
    optionText:  sheetButtonLabel,
    optionTitle: sheetTitle,
  }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. OFFER BANNER CARD — limited_time_offer overlay
//    Best for: premium features, promo announcements, limited-availability items.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{
 *   text:      string,
 *   footer?:   string,
 *   image?:    Buffer,
 *   offerText: string,
 *   offerUrl?: string,
 *   buttons:   Array
 * }} content
 * @param {object} [opts]
 */
export async function offerCard(sock, jid, content, opts = {}) {
  const buttons = cap(content.buttons || []);
  return _send(sock, jid, { ...content, buttons }, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. RICH TABLE CARD — native WA table bubble (botForwardedMessage)
//    Best for: structured lookup results, system stats, data comparisons.
//    Falls back to an ASCII table card with action buttons.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{
 *   title:     string,
 *   headers?:  string[],
 *   rows:      string[][],
 *   footer?:   string,
 *   buttons?:  Array<{ kind: string, label: string, cmd?: string, url?: string, value?: string }>
 * }} opts
 * @param {object} [sendOptions]
 *
 * @example
 * await richTableCard(sock, m.from, {
 *   title:   '🔎 BAN CHECK',
 *   headers: ['Field', 'Value'],
 *   rows:    [['Number', '+1234'], ['Status', '✅ Clean']],
 *   footer:  'Powered by NEXORA-MD',
 *   buttons: [{ kind: 'action', label: '🔁 Check Another', cmd: '.checkwa' }],
 * }, { quoted: m });
 */
export async function richTableCard(sock, jid, { title, headers, rows, footer, buttons = [] }, sendOptions = {}) {
  if (capabilities.richResponse) {
    try {
      const tableRows = [
        ...(headers ? [{ items: headers.map(String) }] : []),
        ...rows.map(r => ({ items: r.map(String) })),
      ];
      await baileysBridge.sendRichResponse(sock, jid, {
        title: title,
        table: tableRows.map(r => r.items),
        footerText: footer || '',
      }, sendOptions);
      if (buttons.length > 0) {
        return await mixedCard(sock, jid, { text: footer || title }, buttons, sendOptions);
      }
      return;
    } catch (err) {
      console.warn('[interactiveKit.richTableCard] richResponse failed, ASCII fallback:', err.message);
    }
  }
  // ASCII table fallback
  const allRows = [...(headers ? [headers] : []), ...rows];
  const widths = (allRows[0] || []).map((_, ci) =>
    Math.min(32, Math.max(...allRows.map(r => String(r[ci] ?? '').length), 4))
  );
  const sep  = c => widths.map(w => c.repeat(w + 2)).join('┼');
  const fmt  = row => '│' + row.map((v, ci) => ` ${String(v ?? '').slice(0, widths[ci]).padEnd(widths[ci])} `).join('│') + '│';
  const lines = [
    `📊 *${title}*`,
    '┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐',
    ...(headers ? [fmt(headers), '├' + sep('─') + '┤'] : []),
    ...rows.map(fmt),
    '└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘',
    ...(footer ? [`\n_${footer}_`] : []),
  ];
  const text = lines.join('\n');
  if (buttons.length > 0) {
    return mixedCard(sock, jid, { text }, buttons, sendOptions);
  }
  return sock.sendMessage(jid, { text }, sendOptions);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. RICH CODE CARD — syntax-highlighted code block (botForwardedMessage)
//    Best for: code generation results, debug output, generated scripts.
//    Falls back to monospace text + cta_copy button.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} sock
 * @param {string} jid
 * @param {{ code: string, language?: string, caption?: string, footer?: string, copyable?: boolean }} opts
 * @param {object} [sendOptions]
 */
export async function richCodeCard(sock, jid, { code, language = 'javascript', caption, footer, copyable = true }, sendOptions = {}) {
  if (capabilities.richResponse) {
    try {
      // tokenizeCode from the fork — lazy import, falls through to fallback if unavailable
      const { tokenizeCode } = await import('baileys/lib/Utils/rich-message-utils.js');
      const codeBlocks = tokenizeCode(code, language);
      await baileysBridge.sendRichResponse(sock, jid, {
        richResponse: [
          ...(caption ? [{ text: caption }] : []),
          { code: codeBlocks, language },
        ],
        footerText: footer || '',
      }, sendOptions);
      if (copyable && code.length <= 4096) {
        return copyResultCard(sock, jid, {
          text:      footer || `Tap below to copy the ${language} snippet:`,
          copyLabel: '📋 Copy Code',
          copyValue: code,
        }, sendOptions);
      }
      return;
    } catch (err) {
      console.warn('[interactiveKit.richCodeCard] richCode fallback:', err.message);
    }
  }
  // Fallback: monospace + copy button
  const truncated = code.length > 3000 ? code.slice(0, 2997) + '…' : code;
  const text = `${caption ? `*${caption}*\n\n` : ''}\`\`\`\n${truncated}\n\`\`\``;
  if (copyable && code.length <= 4096) {
    return copyResultCard(sock, jid, { text, footer, copyLabel: '📋 Copy Code', copyValue: code }, sendOptions);
  }
  return sock.sendMessage(jid, { text }, sendOptions);
}


// ─────────────────────────────────────────────────────────────────────────────
// 10. RICH CAROUSEL CARD — native WA carousel (botForwardedMessage)
//     Best for: products, posts, item lists.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} sock
 * @param {string} jid
 * @param {Array<{ title: string, text: string }>} items
 * @param {object} [sendOptions]
 */
export async function richCarouselCard(sock, jid, items, sendOptions = {}) {
  if (capabilities.richResponse) {
    // Pass links: [] to trigger prepareRichResponseMessage natively for top-level items property
    return await baileysBridge.sendRichResponse(sock, jid, { items, links: [] }, sendOptions);
  }
  const text = items.map(i => `*├ ${i.title}*\n│ ${i.text}`).join('\n\n');
  return sock.sendMessage(jid, { text }, sendOptions);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. RICH MEDIA CARD — inlineImage/inlineVideo
// ─────────────────────────────────────────────────────────────────────────────
export async function richMediaCard(sock, jid, { type = 'image', url, caption, alignment, tapLinkUrl }, sendOptions = {}) {
  if (capabilities.richResponse) {
    const payload = { links: [] }; // trigger flag
    if (type === 'image') {
      payload.inlineImage = url;
      payload.imageText = caption;
    } else {
      payload.inlineVideo = url;
      payload.contentText = caption;
    }
    if (alignment) payload.alignment = alignment;
    if (tapLinkUrl) payload.tapLinkUrl = tapLinkUrl;
    return await baileysBridge.sendRichResponse(sock, jid, payload, sendOptions);
  }
  const payload = type === 'image' ? { image: { url }, caption } : { video: { url }, caption };
  return sock.sendMessage(jid, payload, sendOptions);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. RICH ARTICLE CARD — latex, links, header, disclaimer, suggested
// ─────────────────────────────────────────────────────────────────────────────
export async function richArticleCard(sock, jid, { headerText, contentText, footerText, disclaimerText, latex, links = [], suggested }, sendOptions = {}) {
  if (capabilities.richResponse) {
    return await baileysBridge.sendRichResponse(sock, jid, { 
      headerText, contentText, footerText, disclaimerText, latex, links, suggested 
    }, sendOptions);
  }
  let text = '';
  if (headerText) text += `*${headerText}*\n\n`;
  if (contentText) text += `${contentText}\n\n`;
  if (latex) text += `\n${latex.map(l => l.text).join('\n')}\n\n`;
  if (footerText) text += `_${footerText}_\n`;
  return sock.sendMessage(jid, { text: text.trim() }, sendOptions);
}

export default {
  richCarouselCard,
  richMediaCard,
  richArticleCard,
  actionCard,
  actionCardWithAd,
  linkCard,
  copyResultCard,
  mixedCard,
  selectMenu,
  bottomSheetCard,
  offerCard,
  richTableCard,
  richCodeCard,
};
