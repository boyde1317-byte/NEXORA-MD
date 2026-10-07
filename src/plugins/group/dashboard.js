/**
 * dashboard.js — one-menu control panel for every group feature.
 *
 * The NIXCODE-style "group dashboard": a single native list showing the
 * live on/off state of every per-group toggle, with rows that dispatch
 * the underlying command (`.antilink on` etc.) so admins never memorize
 * a dozen commands again. Fully localized via i18n.
 *
 * Rows are built from the live group record, so the state shown is
 * always what the enforcing code actually reads (db.getGroup(jid).<key>).
 */
import { selectMenu, actionCardWithAd } from '../../lib/interactiveKit.js';
import { LANGUAGES, getChatLanguage, t } from '../../lib/i18n.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';

// Every per-group toggle, in display order.
// key = group record field · cmd = plugin that owns the toggle
const FEATURES = [
  { key: 'antilink',     cmd: 'antilink',     icon: '🔗', desc: 'Delete & warn non-admin links' },
  { key: 'antispam',     cmd: 'antispam',     icon: '🚫', desc: 'Flood/spam guard' },
  { key: 'antisticker',  cmd: 'antisticker',  icon: '🎨', desc: 'Block sticker spam' },
  { key: 'antitag',      cmd: 'antitag',      icon: '🏷️', desc: 'Guard against mass @tags' },
  { key: 'antibot',      cmd: 'antibot',      icon: '🤖', desc: 'Kick other bots' },
  { key: 'antidelete',   cmd: 'antidelete',   icon: '🗑️', desc: 'Recover deleted messages' },
  { key: 'antiforeign',  cmd: 'antiforeign',  icon: '🌍', desc: 'Restrict foreign numbers' },
  { key: 'antiviewonce', cmd: 'antiviewonce', icon: '👁️', desc: 'Bypass view-once media' },
  { key: 'antiword',     cmd: 'antiword',     icon: '🔇', desc: 'Banned-word filter' },
  { key: 'welcome',      cmd: 'welcome',      icon: '👋', desc: 'Greet new members' },
  { key: 'goodbye',      cmd: 'goodbye',      icon: '👋', desc: 'Farewell message on exit' },
];

export default {
  name: 'dashboard',
  aliases: ['panel', 'groupdash', 'gdash'],
  category: 'group',
  description: 'Group dashboard — every group feature in one menu with live on/off states. Tap a row to flip it.',
  permissions: { groupOnly: true, admin: true },
  cooldown: 3000,
  execute: async ({ m, sock, db, prefix, config }) => {
    const p = prefix || '.';
    const lang = getChatLanguage({ db, from: m.from, isGroup: true, config });
    const groupData = db.getGroup(m.from);

    const state = (key) => Boolean(groupData[key]);
    const onCount = FEATURES.filter(f => state(f.key)).length;

    const toggleRow = (f) => {
      const on = state(f.key);
      return {
        id: `${p}${f.cmd} ${on ? 'off' : 'on'}`,
        title: `${on ? '✅' : '❌'} ${f.icon} ${f.cmd.charAt(0).toUpperCase() + f.cmd.slice(1)}`,
        description: `${on ? t(lang, 'dash_disable') : t(lang, 'dash_enable')} — ${f.desc}`,
      };
    };

    const protectionRows = FEATURES.filter(f => !['welcome', 'goodbye'].includes(f.key)).map(toggleRow);
    const greetingRows   = FEATURES.filter(f => ['welcome', 'goodbye'].includes(f.key)).map(toggleRow);

    const currentLang = LANGUAGES[lang] || LANGUAGES.en;

    return await selectMenu(sock, m.from, {
      text: `${t(lang, 'dash_title')}\n\n${t(lang, 'dash_subtitle')}\n\n${t(lang, 'dash_status', { on: onCount, total: FEATURES.length })}`,
      footer: t(lang, 'dash_footer'),
    }, t(lang, 'dash_title'), [
      { title: `🛡️ ${t(lang, 'dash_sec_protection')}`, rows: protectionRows },
      { title: `✨ ${t(lang, 'dash_sec_greetings')}`,   rows: greetingRows },
      { title: `💬 ${t(lang, 'dash_sec_chat')}`, rows: [
        {
          id: `${p}language`,
          title: `${t(lang, 'dash_language_row')} — ${currentLang.flag} ${currentLang.name}`,
          description: t(lang, 'dash_lang_desc', { current: currentLang.name }),
        },
        { id: `${p}groupsettings`, title: '⚙️ Advanced Settings', description: 'Warn thresholds, limits, feature flags' },
        { id: `${p}groupinfo`,     title: '📋 Group Info',          description: 'Members, admin list, description' },
      ]},
    ]);
  },
};
