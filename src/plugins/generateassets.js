import { assetManager } from '../assets/assetManager.js';
import { aiAssetGenerator } from '../assets/aiAssetGenerator.js';

export default {
  name: 'generateassets',
  aliases: ['genassets', 'makeassets'],
  category: 'owner',
  description: 'Regenerates all AI-powered bot assets using Gemini.',
  permissions: {
    owner: true
  },
  cooldown: 5000,
  execute: async ({ m }) => {
    if (!aiAssetGenerator.isEnabled()) {
      return await m.reply('⚠️ *Gemini is not fully configured or is disabled.*\n\nPlease verify that `GEMINI_API_KEY` is set and `GENERATE_ASSETS=true` inside `.env` to enable this feature.');
    }

    await m.reply('🎨 *Regenerating all AI assets...* Please wait while Gemini generates high-quality images. This may take up to a minute.');

    try {
      await assetManager.regenerateAll();
      await m.reply('✅ *All AI assets regenerated successfully!* The new assets have been saved and cached.');
    } catch (err) {
      await m.reply(`❌ *Failed to regenerate assets:* ${err.message}`);
    }
  }
};
