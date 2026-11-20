/**
 * advert.js — .advert — announcement via the automated-greeting spoof.
 *
 * Ported from LUNA MD plugins/iklan.js (commands advert/ad/broadcast),
 * rebranded. Sends the text as an automated greeting message body inside
 * an externalAdReply, then a follow-up message with a Contact Developer
 * button.
 *
 * Differences from the original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - GATING CHANGE: the original had NO owner gate at all (no
 *     handler.owner) — anyone could broadcast. This port is filed under
 *     owner/ and carries `permissions: { owner: true }`, so only the
 *     owner can run it. That is a deliberate tightening, not the
 *     original's behaviour.
 *   - The original also claimed the `ad` and `broadcast` aliases; only
 *     `advert` is kept — `broadcast` is the house owner/broadcast.js
 *     command and must not be shadowed.
 *   - The senderKeyDistributionMessage groupId was a hardcoded LUNA group
 *     id; it is now the current chat. The axolotl blob was hardcoded
 *     base64; it is now a fresh crypto.randomBytes(32) per send.
 *   - The externalAdReply sourceUrl was a WhatsApp channel link; channel
 *     links are not carried into NexoraFlex ports, so it now points at
 *     https://nexora.dev. The thumbnailUrl (athars.space) is kept as-is.
 *   - The Contact Developer button was the old dev's wa.me link;
 *     now wa.me/233533416608 (moonson).
 *   - Unused imports dropped (axios, FormData, downloadContentFromMessage
 *     were imported but never used). No new deps.
 */
import crypto from 'crypto';

const OWNER_NUMBER = '233533416608';

export default {
  name: 'advert',
  aliases: [],
  category: 'owner',
  description: 'Send an announcement as an automated greeting card (owner only). Usage: .advert <text>',
  permissions: { owner: true },
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const cmd = commandName || 'advert';
    const text = args.join(' ').trim();

    if (!text) {
      const helpMessage = `📢 *Advert Command - NEXORA MD*\n\n*How to use:*\n${p + cmd} [advert text]\n\n*Example:*\n• ${p + cmd} Hello everyone, there is an exciting promo today!\n\nDeveloped by NEXORA MD`;
      return await sock.sendMessage(m.from, { text: helpMessage }, { quoted: m });
    }

    await m.react('📢');

    const greetingBody = `${text}\n\n> NEXORA MD`;

    try {
      // Advert greeting trick
      await sock.relayMessage(m.from, {
        senderKeyDistributionMessage: {
          groupId: m.from,
          axolotlSenderKeyDistributionMessage: crypto.randomBytes(32).toString('base64'),
        },
        extendedTextMessage: {
          text: 'SUCCESS ✅',
          contextInfo: {
            externalAdReply: {
              thumbnailUrl: 'https://athars.space/uploads/fee2fff3.jpg',
              thumbnail: '/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAdACADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAwQFAf/EACUQAAEEAQQBBAMAAAAAAAAAAAEAAgMRBAUhMUEiE1FhgRQycf/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAZEQEAAwEBAAAAAAAAAAAAAAAAAQIREiH/2gAMAwEAAhEDEQA/AAfhn2WHF+Eg3WM01cjT/WBP6Zlz5ebDFI8Br3gHxrtKLomob8aukvJDXSoa+9+JqU0MEng07Cga+FDlz8i/2H0An2MKQzB3J+huqWLqD8V7XsFObuCfdSIiGNoBb6h3NcLPPVKmXqoypXyS057zZIHamSSta5xBsk8DhCLiSQNqQSN+VWFEP//Z',
              sourceId: '376c1f20-9703-42b2-85b3-2db22af327a3',
              sourceUrl: 'https://nexora.dev',
              automatedGreetingMessageShown: true,
              greetingMessageBody: greetingBody,
              ctaPayload: 'iniciar_chat',
              automatedGreetingMessageCtaType: 'START_CHAT',
            },
          },
        },
      }, {});

      // Button to the NEXORA MD Developer
      await sock.sendMessage(m.from, {
        text: '✅ *Advert sent successfully by NEXORA MD*\n\nIf you have any problems, contact the Developer below.',
        footer: '© NEXORA MD',
        templateButtons: [
          {
            index: 1,
            urlButton: {
              displayText: '👑 Contact Developer',
              url: `https://wa.me/${OWNER_NUMBER}`,
            },
          },
          {
            index: 2,
            quickReplyButton: {
              displayText: '📢 New Advert',
              id: `${p}advert`,
            },
          },
        ],
      }, { quoted: m });

      await m.react('✅');
    } catch (error) {
      console.error('🚫 Error in the advert command:', error);
      await m.react('❌');
      return await sock.sendMessage(m.from, { text: `❌ Failed to send advert\n\n*Details:* ${error.message}` }, { quoted: m });
    }
  },
};
