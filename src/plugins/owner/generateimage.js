import { aiAssetGenerator } from '../../assets/aiAssetGenerator.js';
import { assetValidator } from '../../assets/assetValidator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'generateimage',
  aliases: ['genimage', 'imagine'],
  category: 'owner',
  description: 'Generates a custom image from a prompt (Gemini, keyless fallback).',
  permissions: {
    owner: true
  },
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    if (!aiAssetGenerator.isEnabled()) {
      return await m.reply.error('Image generation is disabled. Set GEMINI_API_KEY + GENERATE_ASSETS=true, or add POLLINATIONS_TOKEN (free key from auth.pollinations.ai).');
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      return await m.reply.warn('Please provide a prompt.');
    }

    await m.reply.loading('Generating image via AI...');

    await withReactionStatus(m, async () => {
      try {
        const lowerPrompt = prompt.toLowerCase();
        const isWide = lowerPrompt.includes('banner') || lowerPrompt.includes('background') || lowerPrompt.includes('landscape') || lowerPrompt.includes('--wide');
        const aspectRatio = isWide ? '16:9' : '1:1';
        const cleanPrompt = prompt.replace('--wide', '').trim();

        const buffer = await aiAssetGenerator.generateImage(cleanPrompt, aspectRatio);
        const optimized = assetValidator.optimize(buffer);

        await sock.sendMessage(m.from, {
          image: optimized,
          caption: `✦ *Prompt:* ${cleanPrompt}\n✦ *Ratio:* ${aspectRatio}`
        }, { quoted: m });

      } catch (err) {
        await m.reply.error(`Failed to generate image: ${err.message}`);
        throw err;
      }
    });
  }
};
