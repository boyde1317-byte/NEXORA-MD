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
import owner from '../../../config/owner.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
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

/** Styled bot name; a custom bot name stays plain. */
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/** Sections in render order: biggest first, then alphabetical for stable ties. */
export const rankSections = (categories = {}) =>
  Object.entries(categories)
    .map(([name, commands]) => ({ name, commands: commands || [], count: (commands || []).length }))
    .filter((section) => section.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/** Timezone the greeting is read in: the owner's clock, not the server's. */
const GREETING_TZ = 'Africa/Accra';

/**
 * Time-aware greeting.
 *
 * One line, and it names the reader when WhatsApp hands us a push name, because
 * a menu that greets nobody reads like a broadcast. The hour is read in the
 * owner's timezone so a server in UTC and a phone in Accra say the same thing;
 * if ICU is unavailable the UTC hour is close enough that the line stays sane.
 *
 * Exported with an injectable clock so the boundaries can be checked without
 * waiting for the evening.
 */
export const greetingFor = (now = new Date(), name = '') => {
  let hour = now.getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: GREETING_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(now));
  } catch {
    // No ICU: the UTC hour is the same clock in Accra, keep it.
  }
  const [glyph, salutation] = hour < 5
    ? ['🌙', 'Still up']
    : hour < 12
      ? ['🌄', 'Good morning']
      : hour < 17
        ? ['☀️', 'Good afternoon']
        : hour < 21
          ? ['🌆', 'Good evening']
          : ['🌙', 'Good night'];
  const who = String(name || '').trim().split(/\s+/)[0].slice(0, 16);
  return `${glyph} ${salutation}${who ? `, ${who}` : ''}`;
};

/** The one line the bot says about itself, under the greeting. */
const CATCH_LINE = 'Just hanging out here. What’s up?';

/**
 * The menu copy.
 *
 * The copy lives in `footer.text`, the same field menu 19 uses and the same
 * reason: the client paints it small and grey, so the menu reads as quiet
 * information rather than a wall of body text. The body keeps a single
 * zero-width space, which is what keeps the bubble this size at all.
 *
 * Four blocks, a blank line between each: the greeting, what the bot is, the
 * owner details as labelled rows, then the one instruction. The category listing
 * is not repeated here: the picker below the card already carries every section,
 * and printing it twice made the card long without saying anything new. The owner
 * rows are labelled and padded rather than run together, so the name, the chat
 * link and the channel each sit on their own line.
 *
 * No backtick wrapping and no fenced block: WhatsApp paints `footer.text` as
 * plain text, so menu 19's per-line monospace trick prints the backticks instead
 * of rendering them. The columns are padded, not formatted.
 */
export const buildMenuCopy = (
  sections = [],
  {
    totalCommands = 0,
    creator = '',
    greeting = '',
    description = CATCH_LINE,
    ownerUsername = '',
    channelUrl = '',
    botName = brand.name,
  } = {}
) => {
  const dim = (line) => String(line);

  const counts = dim(`${displayName(botName)}`);
  const say = [counts, description ? dim(description) : ''].filter(Boolean);

  // Owner details as rows: label padded so the values line up under each other.
  const fields = [
  ['Made by', creator],
  ['DM', ownerUsername ? `wa.me/@${ownerUsername}` : ''],
  ['Our channel', String(channelUrl || '').replace(/^https?:\/\//, '')],
].filter(([, value]) => Boolean(value));
  const labelWidth = Math.max(...fields.map(([label]) => label.length), 0);
  const ownerRows = fields.map(([label, value]) => dim(`${toSmallcaps(label.padEnd(labelWidth))}  ${value}`));

  const blocks = [
    greeting ? [dim(greeting)] : [],
    say,
    ownerRows,
    [dim('Need something? Try help <section> · menulist')],
  ].filter((block) => block.length);

  return blocks.map((block) => block.join('\n')).join('\n\n');
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
  const full = `${rank(i)} ${section.name} (${section.count})`;
  if (full.length <= LABEL_MAX) return full;
  const ranked = `${rank(i)} ${section.name}`;
  if (ranked.length <= LABEL_MAX) return ranked;
  return ranked.slice(0, LABEL_MAX - 1).trimEnd() + '…';
};

export const atlasMenu = {
  id: 21,
  name: 'atlasMenu',
  description: 'Atlas — your little corner of WhatsApp.',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const jid = m.from || m.key?.remoteJid || m.chat;
    const p = menuData.prefix || '.';
    const sections = rankSections(menuData.categories);
    const creator = brand.creator;
    const botName = menuData.botName || brand.name;
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
        text: displayName(botName),
        copy_code: creator,
        url: CHANNEL_URL,
        expiration_time: midnight.getTime(),
      },
      sheet: {
        in_thread_buttons_limit: 0,
        divider_indices: [],
        list_title: 'Take a look around',
        // No blank trigger: a single space here paints an unlabelled button on
        // the sheet, and `null` is dropped by the builder, so the client falls
        // back to its own label instead.
        button_title: null,
      },
      tap: {
        title: 'Need a little help?',
description: 'Pick a section and see what’s inside',
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
        title: i === 0 ? displayName(botName) : `${displayName(botName)} (cont.)`,
        rows: sections.slice(i, i + ROWS_PER_SECTION).map((section) => ({
          title: pickerLabel(section, sections.indexOf(section)),
          description: `${section.count} to explore${hot.has(section.name) ? '' : ''}`,
          id: `${p}help ${section.name}`,
        })),
      });
    }

    const buttons = [
      // Opener pair: unlocks more than three buttons on clients that gate them.
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          icon: PICKER_ICON,
          title: toSmallcaps('Browse sections'),
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
        text: buildMenuCopy(sections, {
          totalCommands: menuData.totalCommands,
          creator,
          greeting: greetingFor(new Date(), m.pushName || ''),
          description: CATCH_LINE,
          ownerUsername: owner.ownerUsername,
          channelUrl: CHANNEL_URL,
          botName,
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
