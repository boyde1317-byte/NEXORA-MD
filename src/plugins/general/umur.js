/**
 * umur.js — .umur / .age — age + next-birthday card.
 *
 * Ported from LUNA MD plugins/umur.js.
 *
 * Differences from the original:
 *   - `conn.relayMessage(m.chat, ...)` -> `sock.relayMessage(m.from, ...)`
 *     with a `messageContextInfo` carrying a fresh per-send
 *     `messageSecret` + `botResponseId` (house pattern from ping3.js),
 *     and a plain-text fallback if the relay fails.
 *   - Rebrand: "LUNA" / "© Luna - Dev moonson" -> "NEXORA MD".
 *   - The card image is still the third-party catbox link the original
 *     used (https://files.catbox.moe/qnof82.jpg) — it is a generic
 *     picture, not the old owner's personal photo. If that link dies the
 *     card's image slot breaks but the text fallback still sends.
 *   - `m.reply` usage error kept; date maths untouched.
 */
import crypto from 'crypto';

export default {
  name: 'umur',
  aliases: ['age'],
  category: 'general',
  description: 'Show your age and days until your next birthday. Usage: .umur 2/2/2010',
  cooldown: 3000,
  execute: async ({ m, sock, args }) => {
    if (!args[0]) return m.reply('📌 *Usage:* .umur 2/2/2010');

    const input = args[0];
    let d;
    let mo;
    let y;
    if (input.includes('/')) {
      const p = input.split('/');
      d = parseInt(p[0], 10); mo = parseInt(p[1], 10); y = parseInt(p[2], 10);
    } else if (input.includes('-')) {
      const p = input.split('-');
      d = parseInt(p[0], 10); mo = parseInt(p[1], 10); y = parseInt(p[2], 10);
    } else {
      y = parseInt(input, 10); d = 2; mo = 2;
    }
    if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) {
      return m.reply('📌 *Usage:* .umur 2/2/2010');
    }

    const birth = new Date(y, mo - 1, d);
    const now = new Date();
    let tahun = now.getFullYear() - birth.getFullYear();
    let bulan = now.getMonth() - birth.getMonth();
    let hari = now.getDate() - birth.getDate();
    if (hari < 0) { bulan--; hari += 30; }
    if (bulan < 0) { tahun--; bulan += 12; }

    const totalHari = Math.floor((now - birth) / (1000 * 60 * 60 * 24));

    let nextBD = new Date(now.getFullYear(), mo - 1, d);
    if (nextBD < now) nextBD.setFullYear(now.getFullYear() + 1);
    const sisaHari = Math.ceil((nextBD - now) / (1000 * 60 * 60 * 24));
    const sisaBulan = Math.floor(sisaHari / 30);

    const IMAGE_URL = 'https://files.catbox.moe/qnof82.jpg';

    const detailFullName = `🎂 Age: ${tahun}y ${bulan}mo ${hari}d | 📅 Born: ${d}/${mo}/${y} | ⏳ Lived: ${totalHari} days | 🎉 Next birthday: in ${sisaHari} days (${sisaBulan} months) | Next year: ${tahun + 1} years old | © NEXORA MD`;
    const plainText = `🎂 *Age: ${tahun} years, ${bulan} months, ${hari} days*\n📅 Born: ${d}/${mo}/${y}\n⏳ Lived: ${totalHari} days\n🎉 Next birthday: in ${sisaHari} days (${sisaBulan} months)\nNext year: ${tahun + 1} years old`;

    const richMsg = {
      messageType: 1,
      submessages: [],
      unifiedResponse: {
        data: Buffer.from(JSON.stringify({
          sections: [
            {
              view_model: {
                primitives: [{
                  title: `${tahun} Years, ${bulan} Months`,
                  subtitle: `Next birthday in ${sisaHari} days`,
                  secondary_subtitle: `Lived ${totalHari} days • © NEXORA MD`,
                  image: { url: IMAGE_URL, mime_type: 'image/jpeg' },
                  entity_id: '123456',
                  entity_url: 'https://wa.me/',
                  entity_type: 'WEBSITE',
                  action_type: 'OPEN_URL',
                  is_verified: true,
                  __typename: 'GenAICompactEntityPrimitive',
                }],
                __typename: 'GenAIActionRowLayoutViewModel',
              },
            },
            {
              view_model: {
                primitives: [{ type: 'HORIZONTAL_LINE', __typename: 'GenAIDividerPrimitive' }],
                __typename: 'GenAIVStackLayoutViewModel',
              },
            },
            {
              view_model: {
                primitives: [
                  { __typename: 'GenAISpacerPrimitive' },
                  {
                    text: '# {{social_entity_1}}See Remaining Age & Birthday\0{{/social_entity_1}} ',
                    inline_entities: [{
                      key: 'social_entity_1',
                      metadata: {
                        __typename: 'GenAISocialEntityItem',
                        entity_id: `${tahun}`,
                        entity_name: `${sisaHari} days until birthday`,
                        entity_full_name: detailFullName,
                        entity_picture_url: IMAGE_URL,
                        entity_url: 'https://wa.me/',
                        entity_type: 'IG_PROFILE',
                        is_verified: true,
                      },
                    }],
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                  },
                  { __typename: 'GenAISpacerPrimitive' },
                ],
                __typename: 'GenAIActionRowLayoutViewModel',
              },
            },
          ],
        })).toString('base64'),
      },
      contextInfo: { isForwarded: true, forwardOrigin: 4 },
    };

    try {
      await sock.relayMessage(m.from, {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          messageSecret: crypto.randomBytes(32),
          botMetadata: { messageDisclaimerText: '', botResponseId: crypto.randomUUID() },
        },
        botForwardedMessage: { message: { richResponseMessage: richMsg } },
      }, {});
    } catch (err) {
      console.warn('[umur] rich card relay failed, plain fallback:', err?.message);
      await m.reply(plainText);
    }
  },
};
