/**
 * language.js — per-chat language switcher.
 *
 * Group: any admin can set the chat's language (stored on the group
 * record, read by the middleware's system replies via i18n).
 * DM: only the owner can set the bot-wide default language.
 *
 * Uses selectMenu so users see native flags + names instead of codes.
 */
import { selectMenu, actionCardWithAd } from '../../lib/interactiveKit.js';
import { LANGUAGES, normalizeLang, getChatLanguage, getLocalizedResponse, t } from '../../lib/i18n.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { setSetting } from '../../lib/settingsService.js';

export default {
  name: 'language',
  aliases: ['lang', 'bahasa', 'idioma', 'setlang'],
  category: 'utility',
  description: 'Set the chat language. Admins in groups, owner in DMs. Usage: .language <en|id|es|pt> or .language to pick from a list.',
  cooldown: 5000,
  permissions: { groupOnly: false, admin: true },
  execute: async ({ m, sock, args, db, prefix, isGroup, isOwner, config }) => {
    const p = prefix || '.';
    const lang = getChatLanguage({ db, from: m.from, isGroup, config });
    const currentName = `${LANGUAGES[lang]?.flag || ''} ${LANGUAGES[lang]?.name || lang}`.trim();

    const apply = async (code, { viaPicker }) => {
      if (isGroup) {
        db.setGroup(m.from, { language: code });
        return await actionCardWithAd(sock, m.from, {
          text: `${t(code, 'lang_set', { lang: `${LANGUAGES[code].flag} ${LANGUAGES[code].name}` })}`,
          footer: 'NEXORA • Language',
        }, [
          { label: `🛠️ ${viaPicker ? 'Dashboard' : 'Group Dashboard'}`, cmd: `${p}dashboard` },
          { label: `🌐 ${LANGUAGES[code].name}`, cmd: `${p}language` },
        ], {
          title: '🌐 LANGUAGE CHANGED',
          body: `Chat language: ${LANGUAGES[code].name}`,
          thumbnail: await getBrandThumbnail(),
        }, { quoted: m });
      }
      // DM → owner-only global default
      if (!isOwner) {
        return await m.reply.warn(getLocalizedResponse('owner_only', lang));
      }
      const res = setSetting('language', code, { db, config });
      if (!res.ok) return await m.reply.error(res.error);
      return await actionCardWithAd(sock, m.from, {
        text: `${t(code, 'lang_set_global', { lang: `${LANGUAGES[code].flag} ${LANGUAGES[code].name}` })}`,
        footer: 'NEXORA • Language',
      }, [
        { label: '🌐 Change Again', cmd: `${p}language` },
      ], {
        title: '🌐 DEFAULT LANGUAGE',
        body: `Bot-wide default: ${LANGUAGES[code].name}`,
        thumbnail: await getBrandThumbnail(),
      }, { quoted: m });
    };

    // Direct argument: .language id
    const argCode = normalizeLang(args?.[0]);
    if (argCode) return await apply(argCode, { viaPicker: false });

    // Picker: single_select with every supported language
    return await selectMenu(sock, m.from, {
      text: `${t(lang, 'lang_title')}\n\n${t(lang, 'lang_current', { current: `*${currentName}*` })}\n\n${t(lang, 'lang_select')}`,
      footer: t(lang, 'lang_footer'),
    }, t(lang, 'lang_title'), [
      {
        title: t(lang, 'dash_sec_chat'),
        rows: Object.entries(LANGUAGES).map(([code, l]) => ({
          id: `${p}language ${code}`,
          title: `${l.flag} ${l.name}${code === lang ? ' ✓' : ''}`,
          description: code === lang
            ? 'Currently active'
            : `Switch this chat to ${l.name}`,
        })),
      },
    ]);
  },
};
