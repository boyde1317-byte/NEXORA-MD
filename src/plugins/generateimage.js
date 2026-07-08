import { aiAssetGenerator } from '../assets/aiAssetGenerator.js';
import { assetValidator } from '../assets/assetValidator.js';

export default {
  name: 'generateimage',
  aliases: ['genimage', 'imagine'],
  category: 'owner',
  description: 'Generates a custom image based on the prompt using Gemini.',
  permissions: {
    owner: true
  },
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    if (!aiAssetGenerator.isEnabled()) {
      return await m.reply('⚠️ *Gemini is not fully configured or is disabled.*\n\nPlease verify that `GEMINI_API_KEY` is set and `GENERATE_ASSETS=true` inside `.env` to enable this feature.');
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      return await m.reply('⚠️ *Please provide a prompt.* \n\n_Example:_\n!generateimage dark futuristic cybernetic anime girl background');
    }

    await m.reply('🎨 *Generating image via Gemini...* Please wait up to a minute.');

    try {
      // Intelligently select 16:9 for banners or backgrounds, otherwise default to 1:1 square
      const lowerPrompt = prompt.toLowerCase();
      const isWide = lowerPrompt.includes('banner') || lowerPrompt.includes('background') || lowerPrompt.includes('landscape') || lowerPrompt.includes('--wide');
      const aspectRatio = isWide ? '16:9' : '1:1';

      // Clean prompt of option flags
      const cleanPrompt = prompt.replace('--wide', '').trim();

      const buffer = await aiAssetGenerator.generateImage(cleanPrompt, aspectRatio);
      
      // Optional: Auto optimize
      const optimized = assetValidator.optimize(buffer);

      await sock.sendMessage(m.from, {
        image: optimized,
        caption: `🎨 *Generated Image*\n\n*Prompt:* ${cleanPrompt}\n*Aspect Ratio:* ${aspectRatio}`
      }, { quoted: m });
    } catch (err) {
      await m.reply(`❌ *Failed to generate image:* ${err.message}`);
    }
  }
};
