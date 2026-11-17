import { greetingConfig } from './greetingConfig.js';
import { greetingRenderer } from './greetingRenderer.js';
import { messageFormatter } from '../ui/messageFormatter.js';
import { mentionLabel, resolveMentionJid } from '../lib/mentionJid.js';
import { sendAdminAlert } from './adminAlert.js';

export const greetingManager = {
  async handleJoin(sock, jid, userJid) {
    await greetingRenderer.renderAndSend({ sock, jid, userJid, isWelcome: true });

    try {
      const metadata = await sock.groupMetadata(jid);
      const count = metadata.participants?.length ?? 0;
      if (count > 0 && (count % 50 === 0 || count === 10 || count === 100 || count === 500)) {
        const resolvedJid = await resolveMentionJid(sock, userJid, jid);
        const title = '🏆 GROUP MILESTONE REACHED';
        const text = `Congratulations to *${metadata.subject}*!\n\nWe have reached *${count}* members! 🎉\n\n_Welcome our newest member ${mentionLabel(resolvedJid)} for completing this milestone!_`;
        await sock.sendMessage(jid, { text: messageFormatter.info(text, title), mentions: [resolvedJid] });
      }
    } catch (err) {
      console.error('[GREETING MANAGER] Milestone check error:', err.message || err);
    }
  },

  async handleLeave(sock, jid, userJid) {
    await greetingRenderer.renderAndSend({ sock, jid, userJid, isWelcome: false });
  },

  async handlePromotion(sock, jid, userJids) {
    try {
      const metadata = await sock.groupMetadata(jid);
      const groupName = metadata.subject || 'this group';
      for (const userJid of userJids) {
        const resolvedJid = await resolveMentionJid(sock, userJid, jid);
        const text = `🌟 ${mentionLabel(resolvedJid)} has been promoted to *Group Admin* in *${groupName}*!\n\n_Show them some respect and follow their guidelines!_`;
        // Sent with a synthetic group-invite card as the quoted context, so
        // the alert lands as a group card (name + icon + caption) rather than
        // a bare text line.
        await sendAdminAlert(sock, jid, {
          text: messageFormatter.info(text, 'PROMOTION ALERT'),
          resolvedJid,
          groupName,
          isPromotion: true,
        });
      }
    } catch (err) {
      console.error('[GREETING MANAGER] Promotion handler error:', err.message || err);
    }
  },

  async handleDemotion(sock, jid, userJids) {
    try {
      const metadata = await sock.groupMetadata(jid);
      const groupName = metadata.subject || 'this group';
      for (const userJid of userJids) {
        const resolvedJid = await resolveMentionJid(sock, userJid, jid);
        const text = `⚠️ ${mentionLabel(resolvedJid)} is no longer a *Group Admin* in *${groupName}*.\n\n_They have returned to being a regular member._`;
        await sendAdminAlert(sock, jid, {
          text: messageFormatter.info(text, 'DEMOTION NOTICE'),
          resolvedJid,
          groupName,
          isPromotion: false,
        });
      }
    } catch (err) {
      console.error('[GREETING MANAGER] Demotion handler error:', err.message || err);
    }
  }
};

export default greetingManager;
