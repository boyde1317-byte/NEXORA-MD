/**
 * Atlas Menu (id: 21) — a menu computed from the live registry instead of written by hand.
 *
 * Every other style in this folder carries a fixed catalogue: the same ASCII
 * block, the same button wall, the same count on line 3, whether the bot has 12
 * commands or 300. Atlas inverts that. The body is built at render time from
 * `menuData.categories`: sections sorted by size, each with its real command
 * count, and one command promoted to a daily spotlight. Nothing here is a
 * hand-written list, so a new plugin appears in the menu the moment it loads.
 *
 * The dim look is kept, but earned differently. Menu 19 puts its copy in
 * `footer`, which the client paints small and grey. Atlas puts its index in the
 * body inside a monospace fence, which paints grey too but has room for aligned
 * columns — the index needs them, the footer does not.
 *
 * The bar is filled rather than decorative:
 *   limited_time_offer        the spotlight command, copy_code holds it so a
 *                             tap puts the command on the clipboard
 *   bottom_sheet              one divider between the sections picker and the
 *                             category shortcuts
 *   tap_target_configuration  the one thing a new user needs to know
 *
 * What it borrows from menu 19 (technique, not layout): the viewOnce carrier,
 * the opener pair that unlocks more than three buttons, the banner header.
 * What it does not borrow: the decorative button stack, the ASCII frame art,
 * the hand-written info block.
 */
import { generateWAMessageFromContent, generateWAMessageContent } from 'baileys';
import brand from '../../../config/brand.js';
import { buildGalaxyBar } from '../../lib/galaxyBar.js';
import { getChannelPill } from '../../lib/menuContext.js';

/** How many category shortcuts sit under the picker. */
const SHORTCUTS = 6;
/** Rows a single_select section can hold before the client truncates. */
const ROWS_PER_SECTION = 10;
/** Rows per index column block in the body. */
const INDEX_ROWS = 9;

/** Sections in render order: biggest first, then alphabetical for stable ties. */
export const rankSections = (categories = {}) =>
  Object.entries(categories)
    .map(([name, commands]) => ({ name, commands: commands || [], count: (commands || []).length }))
    .filter((section) => section.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/**
 * Pick the spotlight command for a date.
 *
 * Deterministic: the same day always promotes the same command, so the menu
 * does not flicker between renders, and the pick is exposed for tests. It
 * walks the alphabetised command list, which spreads the picks across sections
 * instead of favouring whichever category happens to be largest.
 */
export const pickSpotlight = (categories = {}, dateKey = new Date().toISOString().slice(0, 10)) => {
  const pool = rankSections(categories)
    .flatMap((section) => section.commands.map((cmd) => ({ ...cmd, category: section.name })))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!pool.length) return null;

  let seed = 7;
  for (const ch of String(dateKey)) seed = (seed * 31 + ch.codePointAt(0)) % 100000;
  return pool[seed % pool.length];
};

/** The monospace index. Grey on the client, aligned by column. */
export const buildIndex = (sections, { prefix = '.', totalCommands = 0, spotlight = null } = {}) => {
  const shown = sections.slice(0, INDEX_ROWS);
  const width = Math.max(...shown.map((s) => s.name.length), 4);
  const numberWidth = String(shown.length).length;

  const lines = shown.map((section, i) => {
    const n = String(i + 1).padStart(numberWidth, '0');
    return ` ${n}  ${section.name.padEnd(width)}  ${String(section.count).padStart(3)}`;
  });

  const rest = sections.length - shown.length;
  const tail = rest > 0 ? [` +${rest} more sections in the picker`] : [];

  const head = ` ${brand.name} index · ${totalCommands} commands · ${sections.length} sections`;
  const foot = spotlight
    ? [`\n spotlight  ${prefix}${spotlight.name} — ${String(spotlight.description || '').slice(0, 38)}`]
    : [];

  // Fence on its own line: WhatsApp paints the whole block grey, which is the
  // dim look, and keeps the columns monospaced.
  const block = [head, ' ' + '─'.repeat(Math.min(head.length - 1, 40)), ...lines, ...tail, ...foot];
  return '```\n' + block.join('\n') + '\n```';
};

const catLabel = (section, i) => `${String(i + 1).padStart(2, '0')} ${section.name} · ${section.count}`;

export const atlasMenu = {
  id: 21,
  name: 'atlasMenu',
  description: 'Atlas — index computed from the live plugin registry, daily spotlight, filled galaxy bar',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const jid = m.from || m.key?.remoteJid || m.chat;
    const p = menuData.prefix || '.';
    const sections = rankSections(menuData.categories);
    const spotlight = pickSpotlight(menuData.categories);
    const pill = getChannelPill();

    // ── Banner header: upload the style image, fall back to no header ──
    let header = { hasMediaAttachment: false };
    try {
      const { imageManager } = await import('../../images/imageManager.js');
      const img = await imageManager.getMenuImage(21);
      if (img?.source?.startsWith?.('http')) {
        const media = await generateWAMessageContent(
          { image: { url: img.source } },
          { upload: sock.waUploadToServer }
        );
        header = { hasMediaAttachment: true, imageMessage: media.imageMessage };
      }
    } catch {
      header = { hasMediaAttachment: false };
    }

    // ── Slots: the bar carries what the index cannot say in a column ──
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0);

    const messageParamsJson = buildGalaxyBar({
      offer: spotlight
        ? {
            text: `Spotlight · ${p}${spotlight.name}`,
            copy_code: `${p}${spotlight.name}`,
            url: '',
            expiration_time: midnight.getTime(),
          }
        : {},
      sheet: {
        in_thread_buttons_limit: 0,
        divider_indices: [],
        list_title: 'Sections',
        button_title: ' ',
      },
      tap: {
        title: 'Sections open in chat',
        description: `${p}help <section> lists every command in it`,
        canonical_url: '',
        domain: '',
        button_index: 0,
      },
    });

    // ── Buttons: one picker with every section, then the biggest shortcuts ──
    const pickerSections = [];
    for (let i = 0; i < sections.length && pickerSections.length < 3; i += ROWS_PER_SECTION) {
      pickerSections.push({
        title: i === 0 ? brand.name : `${brand.name} (cont.)`,
        rows: sections.slice(i, i + ROWS_PER_SECTION).map((section) => ({
          title: catLabel(section, sections.indexOf(section)),
          description: `${section.count} commands`,
          id: `${p}help ${section.name}`,
        })),
      });
    }

    const buttons = [
      // Opener pair: unlocks more than three buttons on clients that gate them.
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'All sections',
          sections: pickerSections,
          has_multiple_buttons: true,
        }),
      },
      { name: 'call_permission_request', buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
      ...sections.slice(0, SHORTCUTS).map((section, i) => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: catLabel(section, i),
          id: `${p}help ${section.name}`,
        }),
      })),
    ];

    // One divider: picker above, shortcuts below. It is the only grouping the
    // sheet needs, so it is the only one it gets.
    const withDivider = JSON.parse(messageParamsJson);
    if (withDivider.bottom_sheet) withDivider.bottom_sheet.divider_indices = [2];

    const interactiveMessage = {
      header,
      body: { text: buildIndex(sections, { prefix: p, totalCommands: menuData.totalCommands, spotlight }) },
      footer: {
        text: [`${p}help <section> · ${p}menulist to switch style`, `install · v${brand.version}`].join('\n'),
      },
      nativeFlowMessage: {
        messageParamsJson: JSON.stringify(withDivider),
        buttons,
        messageVersion: 1,
      },
    };

    const generated = generateWAMessageFromContent(
      jid,
      { viewOnceMessage: { message: { interactiveMessage } } },
      {
        ...(sock.user?.id ? { userJid: sock.user.id } : {}),
        ...(pill ? { contextInfo: pill } : {}),
      }
    );
    await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });

    return true;
  },
};

export default atlasMenu;
