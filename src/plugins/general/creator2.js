/**
 * creator2.js — .creator2 — send the developer's contact card.
 *
 * Ported from the LUNA MD main-creator plugin
 * (luna-md/plugins/main-creator.js), which sent a contact for every
 * entry in global.owner. NexoraFlex has no global.owner list; the
 * single developer is moonson, so this sends one vCard for him
 * (233533416608). The old owner's number is not carried over.
 *
 * Why creator2 and not creator: NexoraFlex already ships
 * src/plugins/general/owner.js (.owner / .creator), so this one stays
 * separate and the existing command is untouched.
 */
const DEV_NUMBER = '233533416608';
const DEV_NAME = 'Moonson';

export default {
  name: 'creator2',
  aliases: [],
  category: 'general',
  description: "Send the NEXORA MD developer's contact card.",
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      `N:;${DEV_NAME};;;\n` +
      `FN:${DEV_NAME}\n` +
      `ORG:NEXORA MD\n` +
      `TITLE:Developer\n` +
      `TEL;type=CELL;type=VOICE;waid=${DEV_NUMBER}:${DEV_NUMBER}\n` +
      'END:VCARD';
    await sock.sendMessage(
      m.from,
      { contacts: { displayName: DEV_NAME, contacts: [{ vcard }] } },
      { quoted: m }
    );
  },
};
