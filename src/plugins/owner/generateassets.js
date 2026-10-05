import { assetManager } from '../../assets/assetManager.js';
import { aiAssetGenerator } from '../../assets/aiAssetGenerator.js';

export default {
  name: 'generateassets',
  aliases: ['genassets', 'makeassets'],
  category: 'owner',
  description: 'Regenerates all AI-powered bot assets (Gemini, keyless fallback).',
  permissions: {
    owner: true
  },
  cooldown: 5000,
  execute: async ({ m }) => {
    if (!aiAssetGenerator.isEnabled()) {
      return await m.reply.error('Image generation is disabled. Set GEMINI_API_KEY + GENERATE_ASSETS=true, or add POLLINATIONS_TOKEN (free key from auth.pollinations.ai).');
    }

    await m.reply.loading('Regenerating all visual assets via AI. This might take a minute.');
    try {
      await assetManager.regenerateAll();
      await m.reply.success('All AI assets regenerated successfully.');
    } catch (err) {
      await m.reply.error(`Failed to regenerate assets: ${err.message}`);
    }
  }
};
