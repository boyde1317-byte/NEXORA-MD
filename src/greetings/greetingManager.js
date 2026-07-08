import { greetingConfig } from './greetingConfig.js';
import { greetingRenderer } from './greetingRenderer.js';
import { messageFormatter } from '../ui/messageFormatter.js';

export const greetingManager = {
  /**
   * Handle user joined
   */
  async handleJoin(sock, jid, userJid) {
    await greetingRenderer.renderAndSend({ sock, jid, userJid, isWelcome: true });
    
    // Check if a member count milestone has been achieved
    try {
      const metadata = await sock.groupMetadata(jid);
      const count = metadata.participants ? metadata.participants.length : 0;
      
      // Let's celebrate milestones (every 10, 50, 100, etc. members)
      if (count > 0 && (count % 50 === 0 || count === 10 || count === 100 || count === 500)) {
        const title = `🏆 GROUP MILESTONE REACHED`;
        const text = `Congratulations to *${metadata.subject}*!\n\nWe have reached *${count}* active members! 🎉\n\nWelcome our newest member @${userJid.split('@')[0]} for completing this milestone!`;
        const banner = messageFormatter.info(text, title);
        
        await sock.sendMessage(jid, {
          text: banner,
          mentions: [userJid]
        });
      }
    } catch (e) {
      // Milestones fallback gracefully if metadata loading fails
    }
  },

  /**
   * Handle user left
   */
  async handleLeave(sock, jid, userJid) {
    await greetingRenderer.renderAndSend({ sock, jid, userJid, isWelcome: false });
  },

  /**
   * Handle admin promotions
   */
  async handlePromotion(sock, jid, userJids) {
    try {
      const metadata = await sock.groupMetadata(jid);
      const groupName = metadata.subject || 'this group';

      for (const userJid of userJids) {
        const userNumber = userJid.split('@')[0];
        const text = `🌟 @${userNumber} has been promoted to *Group Admin* inside *${groupName}*!\n\nShow them some respect and follow their guidelines!`;
        const card = messageFormatter.info(text, 'PROMOTION ALERT');

        await sock.sendMessage(jid, {
          text: card,
          mentions: [userJid]
        });
      }
    } catch (err) {
      console.error('[GREETING MANAGER] Promotion error:', err);
    }
  },

  /**
   * Handle admin demotions
   */
  async handleDemotion(sock, jid, userJids) {
    try {
      const metadata = await sock.groupMetadata(jid);
      const groupName = metadata.subject || 'this group';

      for (const userJid of userJids) {
        const userNumber = userJid.split('@')[0];
        const text = `⚠️ @${userNumber} is no longer a *Group Admin* inside *${groupName}*.\n\nThey have returned to being a regular member.`;
        const card = messageFormatter.info(text, 'DEMOTION NOTICE');

        await sock.sendMessage(jid, {
          text: card,
          mentions: [userJid]
        });
      }
    } catch (err) {
      console.error('[GREETING MANAGER] Demotion error:', err);
    }
  }
};

export default greetingManager;
