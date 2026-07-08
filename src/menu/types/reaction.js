import { buildCompactMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const reactionMenu = {
  id: 11,
  name: 'reaction',
  description: 'Ultra-lightweight reaction-triggered and live-edited inline menu',
  supportedMessages: ['react', 'edit'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(11);

    // 1. React with a loading emoji (non-critical — ignore failure)
    try { await m.react('⏳'); } catch (_) {}

    // 2. Send the loading placeholder
    const loadingMsg = await sock.sendMessage(m.from, {
      text: `🤖 *${menuData.botName.toUpperCase()} CONSOLE*\n\n⏳ _Synchronizing plugins and command directories..._`
    }, { quoted: m });

    // 3. Brief pause for UX
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 4. Update reaction to complete (non-critical)
    try { await m.react('✅'); } catch (_) {}

    // 5. Build the final menu text
    const finalMenuText = buildCompactMenu(menuData);

    // ── Tier 1: Live-edit the loading message ─────────────────────────────
    if (loadingMsg?.key) {
      try {
        return await sock.sendMessage(m.from, {
          text: finalMenuText,
          edit: loadingMsg.key
        });
      } catch (editErr) {
        console.warn('[MENU reaction] Tier 1 (live-edit) failed on this client, sending new message:', editErr.message);
        // Attempt to delete the stale loading message so it doesn't confuse the user
        try {
          await sock.sendMessage(m.from, { delete: loadingMsg.key });
        } catch (_) {}
      }
    }

    // ── Tier 2: Send as a fresh message (edit unsupported) ────────────────
    return await sock.sendMessage(m.from, { text: finalMenuText }, { quoted: m });
  }
};

export default reactionMenu;
