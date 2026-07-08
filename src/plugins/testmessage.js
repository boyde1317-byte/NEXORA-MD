import capabilities from '../core/capabilities.js';
import bottomSheetBuilder from '../ui/experimental/bottomSheetBuilder.js';
import offerOverlayBuilder from '../ui/experimental/offerOverlayBuilder.js';
import advancedNativeFlowBuilder from '../ui/experimental/advancedNativeFlowBuilder.js';
import { baileysBridge } from '../core/baileysBridge.js';
import newsletterManager from '../newsletter/newsletterManager.js';
import newsletterBuilder from '../newsletter/newsletterBuilder.js';

export default {
  name: 'testmessage',
  aliases: ['testmsg', 'msgdebug'],
  category: 'owner',
  description: 'Tests advanced/experimental UI messages with direct capability feedback and error logging.',
  permissions: {
    owner: true
  },
  cooldown: 3000,
  execute: async ({ sock, m, args, prefix }) => {
    if (!args[0]) {
      return await m.reply(
        `⚠️ *Usage:* \`${prefix}testmessage <bottomsheet|offer|nativeflow|newsletter|channelinvite>\`\n\n` +
        `_Example:_ \`${prefix}testmessage newsletter\``
      );
    }

    const type = args[0].toLowerCase();

    if (type === 'bottomsheet') {
      const isSupported = bottomSheetBuilder.validate();
      const statusText = isSupported ? 'SUPPORTED ✓' : 'UNSUPPORTED ✗';
      
      await m.reply(`🔍 *BOTTOM SHEET CAPABILITY ENGINE*\n\n• *Status:* ${statusText}\n• *Checking:* \`proto.Message.bottomSheetMessage\` / \`nativeFlowMessage\`\n\n_Attempting payload dispatch..._`);

      try {
        const testData = {
          title: 'NEXORA TEST SHEET',
          description: 'This is an experimental WhatsApp Bottom Sheet overlay.',
          footer: 'Nexora Core Intelligence',
          sections: [
            {
              title: 'SYSTEM CHECKS',
              rows: [
                { id: 'ping', title: 'Speed Test', description: 'Measure bot latency' },
                { id: 'about', title: 'System Info', description: 'Show runtime statistics' }
              ]
            }
          ]
        };

        if (isSupported) {
          const payload = bottomSheetBuilder.build(testData);
          await sock.sendMessage(m.from, {
            text: payload.text,
            footer: payload.footer,
            buttons: payload.buttons.map(btn => ({
              name: btn.name,
              buttonParamsJson: JSON.stringify(btn.params)
            }))
          }, { quoted: m });
          await m.reply(`✅ *PAYLOAD SENT:* Bottom sheet dispatch succeeded!`);
        } else {
          await bottomSheetBuilder.fallback(sock, m.from, testData, { quoted: m });
          await m.reply(`⚠️ *FALLBACK DISPATCHED:* Standard flow was sent due to un-detected capability.`);
        }
      } catch (err) {
        console.error('[DEBUG ENGINE] Bottom Sheet Payload Error:', err);
        await m.reply(`❌ *PAYLOAD ERROR:* Dispatch failed!\n\n_Log:_ \`${err.message || err}\``);
      }

    } else if (type === 'offer') {
      const isSupported = offerOverlayBuilder.validate();
      const statusText = isSupported ? 'SUPPORTED ✓' : 'UNSUPPORTED ✗';

      await m.reply(`🔍 *OFFER OVERLAY CAPABILITY ENGINE*\n\n• *Status:* ${statusText}\n• *Checking:* \`proto.Message.offerTextMessage\` / \`interactiveMessage\`\n\n_Attempting payload dispatch..._`);

      try {
        const testData = {
          title: 'NEXORA SPECIAL OFFER',
          offer: 'NEXORA MD PREMIUM ACTIVE',
          body: 'This custom overlay text layer is designed to capture attention.',
          footer: 'By Aizen',
          buttons: [
            { name: 'quick_reply', params: { display_text: 'Acknowledge', id: 'ack' } }
          ]
        };

        if (isSupported) {
          const payload = offerOverlayBuilder.build(testData);
          await baileysBridge.relayMessage(sock, m.from, { viewOnceMessage: { message: payload } }, { quoted: m });
          await m.reply(`✅ *PAYLOAD SENT:* Offer overlay dispatch succeeded!`);
        } else {
          await offerOverlayBuilder.fallback(sock, m.from, testData, { quoted: m });
          await m.reply(`⚠️ *FALLBACK DISPATCHED:* Clean text/button sent due to capability limitations.`);
        }
      } catch (err) {
        console.error('[DEBUG ENGINE] Offer Overlay Payload Error:', err);
        await m.reply(`❌ *PAYLOAD ERROR:* Dispatch failed!\n\n_Log:_ \`${err.message || err}\``);
      }

    } else if (type === 'nativeflow') {
      const isSupported = advancedNativeFlowBuilder.validate();
      const statusText = isSupported ? 'SUPPORTED ✓' : 'UNSUPPORTED ✗';

      await m.reply(`🔍 *NATIVE FLOW CARDS ENGINE*\n\n• *Status:* ${statusText}\n• *Checking:* \`proto.Message.InteractiveMessage.NativeFlowMessage\`\n\n_Attempting payload dispatch..._`);

      try {
        const testData = {
          title: 'NEXORA HIGH-FIDELITY CARD',
          body: 'Advanced native action buttons in single card container.',
          footer: 'Nexora Guard',
          buttons: [
            { name: 'cta_url', params: { display_text: '🌐 Visit Workspace', url: 'https://ai.studio/build' } },
            { name: 'quick_reply', params: { display_text: '⚡ Trigger Ping', id: `${prefix}ping` } }
          ]
        };

        if (isSupported) {
          const payload = advancedNativeFlowBuilder.build(testData);
          await baileysBridge.sendNativeFlow(sock, m.from, payload, { quoted: m });
          await m.reply(`✅ *PAYLOAD SENT:* Native Flow card dispatch succeeded!`);
        } else {
          await advancedNativeFlowBuilder.fallback(sock, m.from, testData, { quoted: m });
          await m.reply(`⚠️ *FALLBACK DISPATCHED:* Standard interactive card sent.`);
        }
      } catch (err) {
        console.error('[DEBUG ENGINE] Native Flow Payload Error:', err);
        await m.reply(`❌ *PAYLOAD ERROR:* Dispatch failed!\n\n_Log:_ \`${err.message || err}\``);
      }

    } else if (type === 'newsletter' || type === 'channelinvite') {
      const isSupported = newsletterBuilder.validate();
      const statusText = isSupported ? 'SUPPORTED ✓' : 'UNSUPPORTED ✗';

      await m.reply(`🔍 *NEWSLETTER ADMIN INVITE ENGINE*\n\n• *Status:* ${statusText}\n• *Checking:* \`proto.Message.newsletterAdminInviteMessage\`\n\n_Attempting payload dispatch..._`);

      try {
        if (isSupported) {
          await newsletterManager.sendNewsletterInvite(sock, m.from, {
            name: 'Nexora Core Channel',
            caption: 'Join the next-gen update stream.',
            forwardingEnabled: true
          }, { quoted: m });
          await m.reply(`✅ *PAYLOAD SENT:* Newsletter invitation card dispatched!`);
        } else {
          await newsletterBuilder.fallback(sock, m.from, {
            name: 'Nexora Core Channel',
            caption: 'Join the next-gen update stream.'
          }, { quoted: m });
          await m.reply(`⚠️ *FALLBACK DISPATCHED:* Standard ad-reply was sent.`);
        }
      } catch (err) {
        console.error('[DEBUG ENGINE] Newsletter Payload Error:', err);
        await m.reply(`❌ *PAYLOAD ERROR:* Dispatch failed!\n\n_Log:_ \`${err.message || err}\``);
      }

    } else {
      await m.reply(`❌ Invalid test target: *"${args[0]}"*.\nValid targets: \`bottomsheet\`, \`offer\`, \`nativeflow\`, \`newsletter\`, \`channelinvite\`.`);
    }
  }
};
