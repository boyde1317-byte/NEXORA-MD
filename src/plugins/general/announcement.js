/**
 * announcement.js — .announcement (alias .ad) — greeting-spoof announcement.
 *
 * Ported from the LUNA MD plugins/#U0627#U0639#U0644#U0627#U0646.js
 * ("announcement"). The message is sent through a relayed
 * extendedTextMessage carrying an externalAdReply with
 * automatedGreetingMessageShown, so it arrives looking like an
 * automated greeting / announcement card.
 *
 * KEPT AS-IS (part of the mechanism, do not "clean up"):
 *   - The senderKeyDistributionMessage blob (axolotl sender key) and
 *     the hardcoded groupId "120363409081009083@g.us" — the relay
 *     needs them to deliver the spoofed greeting shape.
 *   - The base64 thumbnail blob (generic image payload, not branding).
 *
 * CHANGED on port:
 *   - ESM + NexoraFlex plugin contract; `conn` -> `sock`,
 *     `m.chat` -> `m.from`.
 *   - Branding: "◠⿻ Luna MD" footer -> "NEXORA MD".
 *   - The old owner's WhatsApp channel link in sourceUrl is dropped;
 *     it now points at https://nexora.dev (no hardcoded channel links).
 *   - No permission gating in the original — preserved as-is (anyone
 *     can use it). If moonson wants it restricted, gate it later.
 */
export default {
  name: 'announcement',
  aliases: ['ad'],
  category: 'general',
  description: 'Send an announcement styled as an automated greeting card. Usage: .announcement <text>',
  cooldown: 3000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const text = args.join(' ').trim();

    if (!text) {
      return await m.reply(
        '📢 *Announcement Command*\n\n' +
        '*Usage:* \n' +
        `${p}announcement [announcement text]\n\n` +
        '*Example:*\n' +
        `• ${p}announcement hello`,
      );
    }

    try { await m.react('📢'); } catch (_) {}

    const greetingBody = `${text}\n\n> NEXORA MD`;

    try {
      await sock.relayMessage(m.from, {
        senderKeyDistributionMessage: {
          groupId: '120363409081009083@g.us',
          axolotlSenderKeyDistributionMessage: 'Mwim6ND6BRCnDRogjMm2TC7HotXA68Nmk2zXg4hAvrWASgcGMeavcvL3R/EiIQVnxnpnAetl0rySQOwKtn4GmB86hX0MLxA5qC8F5wk9Xg==',
        },
        extendedTextMessage: {
          text: 'DONE ✅',
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

      try { await m.react('✅'); } catch (_) {}
    } catch (error) {
      console.error('🚫 Error in announcement command:', error);
      try { await m.react('❌'); } catch (_) {}
      return await m.reply(`❌ Failed to send announcement\n\n${error.message}`);
    }
  },
};
