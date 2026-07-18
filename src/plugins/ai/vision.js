import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { copyResultCard } from '../../lib/interactiveKit.js';
import { downloadMediaMessage } from 'baileys';

export default {
  name: 'vision',
  aliases: ['analyze', 'imageai'],
  category: 'ai',
  description: 'Analyzes an image using AI. Reply to an image with !vision [prompt].',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, rawMessage }) => {
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error('AI is not configured. Set GEMINI_API_KEY in .env.');
    }
    
    // Ensure there is an image to analyze
    const isImage = m.msg?.mimetype?.includes('image') || m.quoted?.mimetype?.includes('image');
    if (!isImage) {
      return await m.reply.info(`Usage: Reply to an image with \`${prefix}vision <optional prompt>\``, 'NEXORA AI VISION');
    }

    const prompt = args.join(' ').trim() || 'Describe this image in detail.';

    await withReactionStatus(m, async () => {
      try {
        const targetMessage = m.quoted ? rawMessage.message.extendedTextMessage.contextInfo.quotedMessage : rawMessage.message;
        const targetType = Object.keys(targetMessage)[0];
        
        // Ensure it's not a view once, sticker etc. unless baileys supports it
        const buffer = await downloadMediaMessage(
          { key: m.quoted ? m.msg.contextInfo.stanzaId : m.key, message: targetMessage },
          'buffer',
          {},
          { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer) throw new Error('Failed to download image.');

        const reply = await aiTextGenerator.analyzeImage(buffer, prompt);
        
        await copyResultCard(sock, m.from, {
          text: `👁️ *AI VISION ANALYSIS*\n\n*Prompt:* ${prompt}\n\n${reply}`,
          footer: 'Nexora AI Vision',
          copyLabel: '📋 Copy Analysis',
          copyValue: reply
        }, { quoted: m });
      } catch (err) {
        await m.reply.error(`Failed to analyze image: ${err.message}`);
        throw err;
      }
    });
  }
};
