/**
 * Atlas Menu (id: 21) — a menu computed from the live registry instead of written by hand.
 *
 * Every other style in this folder carries a fixed catalogue: the same ASCII
 * block, the same button wall, the same count on line 3, whether the bot has 12
 * commands or 300. Atlas inverts that. The index is built at render time from
 * `menuData.categories`: sections sorted by size, each with its real command
 * count. Nothing here is a hand-written list, so a new plugin appears in the
 * menu the moment it loads.
 *
 * The dim look comes from the same place it comes from in menu 19: the copy
 * lives in `footer.text`, which the client paints small and grey, while the body
 * carries a single zero-width space. Every line goes out bare: the footer is
 * painted as plain text, so single backticks there are not formatting, they are
 * just characters sitting in front of the user's rows.
 *
 * Two deliberate silences: no prefix is printed anywhere in the interface (an
 * owner knows their own prefix, and a printed one goes stale the moment it
 * changes), and no rule lines or box art (a row of dashes reads as noise at
 * footer size, which is the opposite of what this menu is for).
 *
 * The bar is filled rather than decorative:
 *   limited_time_offer        the bot name, linking to the channel, with the
 *                             creator on the copy affordance
 *   bottom_sheet              one divider between the sections picker and the
 *                             category shortcuts
 *   tap_target_configuration  the one thing a new user needs to know
 *
 * The picker carries no extra group. Categories that hold the most-run commands
 * (ranked from the counter the dispatcher persists in `db.stats.commandsUsed`)
 * are marked where they already sit, so the index stays as long as the registry
 * says and a row still opens a category rather than jumping into a command.
 *
 * What it borrows from menu 19 (technique, not layout): the viewOnce carrier,
 * the opener pair that unlocks more than three buttons, the banner header.
 * What it does not borrow: the decorative button stack, the ASCII frame art,
 * the hand-written info block.
 */
import { generateWAMessageFromContent, generateWAMessageContent } from 'baileys';
import brand from '../../../config/brand.js';
import { buildGalaxyBar, BAR_ZWSP } from '../../lib/galaxyBar.js';

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326';
import { getChannelPill } from '../../lib/menuContext.js';

/** How many category shortcuts sit under the picker. */
const SHORTCUTS = 6;
/** Rows a single_select section can hold before the client truncates. */
const ROWS_PER_SECTION = 10;
/**
 * Picker blocks. The client holds 10 sections of 10 rows, and one row here is
 * one category, so ten blocks cover 100 categories, which is the client's own ceiling.
 * The old cap of three blocks silently stranded every section past the 30th
 * while the index still promised it sat in the picker.
 */
const PICKER_BLOCKS = 10;
/** Rows per index column block in the body. */
const INDEX_ROWS = 9;
/** quick_reply display_text is cut by the client past this width. */
const LABEL_MAX = 20;

/**
 * Glyph on the section picker. The client maps a `single_select`'s `icon` name to
 * its own glyph; DOCUMENT, REVIEW and PROMOTION are the three names this repo has
 * proven on a device (menu 19, messagebuilder). REVIEW is the thumbs up, the
 * reviewer's mark rather than the page menu 19 puts on its index, because this
 * picker browses sections the same way menu 19's review picker does. An
 * unrecognised name degrades to no icon rather than breaking the card, so nothing
 * here is load bearing.
 */
const PICKER_ICON = 'REVIEW';

/** Sections in render order: biggest first, then alphabetical for stable ties. */
export const rankSections = (categories = {}) =>
  Object.entries(categories)
    .map(([name, commands]) => ({ name, commands: commands || [], count: (commands || []).length }))
    .filter((section) => section.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/**
 * The dim index.
 *
 * The copy lives in `footer.text`, the same field menu 19 uses and the same
 * reason: the client paints it small and grey, so the menu reads as quiet
 * information rather than a wall of body text. The body keeps a single
 * zero-width space, which is what keeps the bubble this size at all.
 *
 * No backtick wrapping and no fenced block: WhatsApp paints `footer.text` as
 * plain text, so menu 19's per-line monospace trick prints the backticks instead
 * of rendering them. The columns are padded, not formatted.
 */
export const buildDimIndex = (sections, { totalCommands = 0, creator = '', pickerRows = Infinity } = {}) => {
  const shown = sections.slice(0, INDEX_ROWS);
  const width = Math.max(...shown.map((s2) => s2.name.length), 4);
  const dim = (line) => String(line);

  const rows = shown.map((section, i) =>
    dim(`${String(i + 1).padStart(String(shown.length).length, '0')} ${section.name.padEnd(width)} ${String(section.count).padStart(3)}`));

  // Only promise the picker for the sections it actually carries: with more
  // categories than the picker can hold, the tail points at `help` instead of
  // claiming rows that are not there.
  const rest = sections.length - shown.length;
  const inPicker = rest > 0 ? Math.max(0, Math.min(rest, pickerRows - shown.length)) : 0;
  const tail = inPicker > 0
    ? [dim(inPicker === rest ? `+${rest} more in the picker` : `+${inPicker} in the picker · +${rest - inPicker} via help`)]
    : rest > 0
      ? [dim(`+${rest} more · help <section>`)]
      : [];
  const head = dim(`${brand.name} · ${totalCommands} commands · ${sections.length} sections`);
  const signature = creator ? [dim(creator)] : [];

  // Signature and hint sit outside the index rows: credit, then the only
  // instruction, and no prefix on it.
  const hint = 'help <section> · menulist';
  return [head, ...rows, ...tail, '', ...(signature.length ? [...signature, ''] : []), hint].join('\n');
};

const rank = (i) => String(i + 1).padStart(2, '0');

/**
 * Picker row title. The old title carried the count and the row description
 * repeated it, so every row said the same number twice. The index rank stays,
 * so the row still ties back to its line in the footer.
 */
const pickerLabel = (section, i) => `${rank(i)} ${section.name}`;

/**
 * Shortcut label, clamped to what a quick_reply button can actually show.
 * A long category name used to overflow the label and lose the tail; the count
 * is dropped before the name is, and the rank always survives.
 */
const catLabel = (section, i) => {
  const full = `${rank(i)} ${section.name} · ${section.count}`;
  if (full.length <= LABEL_MAX) return full;
  const ranked = `${rank(i)} ${section.name}`;
  if (ranked.length <= LABEL_MAX) return ranked;
  return ranked.slice(0, LABEL_MAX - 1).trimEnd() + '…';
};

export const atlasMenu = {
  id: 21,
  name: 'atlasMenu',
  description: 'Atlas — index computed from the live plugin registry, daily spotlight, filled galaxy bar',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const jid = m.from || m.key?.remoteJid || m.chat;
    const p = menuData.prefix || '.';
    const sections = rankSections(menuData.categories);
    const creator = brand.creator;
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
      offer: {
        text: brand.name,
        copy_code: creator,
        url: CHANNEL_URL,
        expiration_time: midnight.getTime(),
      },
      sheet: {
        in_thread_buttons_limit: 0,
        divider_indices: [],
        list_title: 'Sections',
        // No blank trigger: a single space here paints an unlabelled button on
        // the sheet, and `null` is dropped by the builder, so the client falls
        // back to its own label instead.
        button_title: null,
      },
      tap: {
        title: 'Sections open in chat',
        description: 'help <section> lists every command in it',
        canonical_url: '',
        domain: '',
        button_index: 0,
      },
    });

    // ── Buttons: one picker with every section, then the biggest shortcuts ──
    // No extra group: the index already lists every category, so the ones the bot
    // is actually driven through are marked where they sit. The mark lands in the
    // row rather than as a section pill, because `highlight_label` is a section
    // field and a one-row group per popular category would pad the index.
    const hot = new Set(
      (menuData.topCommands || []).map((cmd) => cmd.category).filter(Boolean)
    );
    const pickerSections = [];
    for (let i = 0; i < sections.length && pickerSections.length < PICKER_BLOCKS; i += ROWS_PER_SECTION) {
      pickerSections.push({
        title: i === 0 ? brand.name : `${brand.name} (cont.)`,
        rows: sections.slice(i, i + ROWS_PER_SECTION).map((section) => ({
          title: pickerLabel(section, sections.indexOf(section)),
          description: `${section.count} commands${hot.has(section.name) ? ' · Most used' : ''}`,
          id: `${p}help ${section.name}`,
        })),
      });
    }
    const pickerCategoryRows = pickerSections.reduce((n, block) => n + block.rows.length, 0);

    const buttons = [
      // Opener pair: unlocks more than three buttons on clients that gate them.
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          icon: PICKER_ICON,
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
      // Body is one zero-width space: the dim look comes from putting the copy
      // in the footer, not from wrapping the message in a code block.
      body: { text: BAR_ZWSP },
      footer: {
        text: buildDimIndex(sections, {
          totalCommands: menuData.totalCommands,
          creator,
          pickerRows: pickerCategoryRows,
        }),
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
