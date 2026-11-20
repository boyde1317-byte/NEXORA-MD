/**
 * toggle.js — .toggle / .enable / .disable / .on / .off <feature> —
 * flip bot features on or off.
 *
 * Ported from the LUNA MD on plugin (luna-md/plugins/on.js). The file
 * is NOT owner-only — group admins can flip the per-group features and
 * any user can flip their own autolevelup — so it lives in category
 * general with no plugin-level permission gate; the per-feature gates
 * below are enforced inside execute, as in the original.
 *
 * NexoraFlex mappings (LUNA db -> house db):
 *   - chats.<group>.welcome / .detect / .delete -> db.getGroup(m.from)
 *     flags welcome / detect / antidelete, written with db.setGroup.
 *     (welcome is read by the house .welcome command; antidelete is
 *     read by the anti-guard suite in src/handlers/message.js; detect
 *     has no live consumer yet — the flag is still stored.)
 *   - users.<sender>.autolevelup -> db.setUser(m.sender, { autolevelup }).
 *   - settings.autoread / .public / .gconly / .anticall (bot-wide,
 *     owner-only) -> db.setSettings: autoRead, publicMode, gconly,
 *     anticall. autoRead/publicMode/anticall are the legacy flat keys
 *     the settings service already honors.
 *   - Admin checks use the serialized message's await m.isAdmin();
 *     owner status comes from the execute context (isOwner).
 *   - global.dfail() (LUNA's failure helper) does not exist here;
 *     denials are plain m.reply lines.
 *
 * `.toggle <feature>` with no on/off flips the current value.
 */
const ENABLE_WORDS = new Set(['enable', 'on', 'true', '1']);
const DISABLE_WORDS = new Set(['disable', 'off', 'false', '0']);

const GROUP_FEATURES = new Set(['welcome', 'detect', 'antidelete', 'delete']);
const USER_FEATURES = new Set(['autolevelup']);
const OWNER_FEATURES = new Set(['autoread', 'public', 'gconly', 'grouponly', 'anticall']);

function normalizeFeature(type) {
  if (type === 'delete') return 'antidelete';
  if (type === 'grouponly') return 'gconly';
  return type;
}

export default {
  name: 'toggle',
  aliases: ['enable', 'disable', 'on', 'off'],
  category: 'general',
  description: 'Enable or disable a feature. Usage: .enable welcome | .disable autoread | .toggle welcome off',
  cooldown: 2000,
  execute: async ({ m, args, prefix, resolvedName, isOwner, db }) => {
    const p = prefix || '.';
    const invoked = String(resolvedName || 'toggle').toLowerCase();

    let type = (args[0] || '').toLowerCase();
    let want;
    if (invoked === 'toggle') {
      const word = (args[1] || '').toLowerCase();
      if (ENABLE_WORDS.has(word)) want = true;
      else if (DISABLE_WORDS.has(word)) want = false;
      // No on/off word: flip the current value (resolved below).
    } else if (ENABLE_WORDS.has(invoked)) {
      want = true;
    } else if (DISABLE_WORDS.has(invoked)) {
      want = false;
    }

    type = normalizeFeature(type);

    const listReply = () => m.reply(
      `*List of options you can set:*\n\n` +
      `*For Users:*\n- autolevelup\n\n` +
      `*For Group Admins:*\n- welcome\n- detect\n- antidelete\n` +
      (isOwner
        ? `\n*For the Bot Owner:*\n- autoread\n- public\n- anticall\n- gconly\n`
        : '') +
      `\n*Usage examples:*\n- ${p}enable welcome\n- ${p}disable welcome\n- ${p}toggle welcome off`
    );

    if (!type || (!GROUP_FEATURES.has(type) && !USER_FEATURES.has(type) && !OWNER_FEATURES.has(type))) {
      return listReply();
    }

    const isGroupFeature = GROUP_FEATURES.has(type);
    const isUserFeature = USER_FEATURES.has(type);
    const isOwnerFeature = OWNER_FEATURES.has(type);

    // ── Gates ──────────────────────────────────────────────────────────
    if (isOwnerFeature && !isOwner) {
      return m.reply('❌ Only the bot owner can toggle this feature.');
    }
    if (isGroupFeature) {
      if (!m.isGroup) return m.reply('❌ This feature can only be toggled inside a group.');
      const senderIsAdmin = await m.isAdmin();
      if (!senderIsAdmin && !isOwner) {
        return m.reply('❌ Only group admins can toggle this feature.');
      }
    }

    // ── Read current value (needed when .toggle flips without on/off) ──
    const readCurrent = () => {
      if (isGroupFeature) return !!db.getGroup(m.from)[type];
      if (isUserFeature) return !!db.getUser(m.sender).autolevelup;
      const settings = db.getSettings();
      if (type === 'autoread') return settings.autoRead ?? false;
      if (type === 'public') return settings.publicMode ?? true;
      if (type === 'gconly') return !!settings.gconly;
      if (type === 'anticall') return !!settings.anticall;
      return false;
    };
    const isEnable = want !== undefined ? want : !readCurrent();

    // ── Write ──────────────────────────────────────────────────────────
    if (isGroupFeature) {
      db.setGroup(m.from, { [type]: isEnable });
    } else if (isUserFeature) {
      db.setUser(m.sender, { autolevelup: isEnable });
    } else if (type === 'autoread') {
      db.setSettings({ autoRead: isEnable });
    } else if (type === 'public') {
      db.setSettings({ publicMode: isEnable });
    } else if (type === 'gconly') {
      db.setSettings({ gconly: isEnable });
    } else if (type === 'anticall') {
      db.setSettings({ anticall: isEnable });
    }

    const scope = isOwnerFeature ? 'for the bot' : isUserFeature ? 'for you' : 'for this chat';
    return m.reply(`*${type}* has been *${isEnable ? 'enabled' : 'disabled'}* ${scope}`);
  },
};
