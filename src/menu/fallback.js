import { buildTextMenu } from './formatter.js';

/**
 * Executes a menu renderer inside a try/catch containment zone.
 * If the renderer crashes or is unsupported by the platform,
 * it falls back to sending a beautifully formatted high-contrast text menu.
 * 
 * @param {Function} renderFn - The active menu renderer function to execute
 * @param {object} context - Context params: { sock, m, menuData }
 */
export const runWithFallback = async (renderFn, { sock, m, menuData }) => {
  try {
    await renderFn({ sock, m, menuData });
  } catch (err) {
    console.error(`[MENU ENGINE] Render failed, deploying fallback:`, err.message || err);
    
    try {
      const fallbackText = buildTextMenu(menuData);
      const notice = `⚠️ *Notice:* The configured premium menu layout encountered a render error and safely degraded to standard text.\n\n${fallbackText}`;
      
      await sock.sendMessage(m.from, { text: notice }, { quoted: m });
    } catch (fallbackErr) {
      console.error(`[CRITICAL] Menu fallback channel crashed:`, fallbackErr);
    }
  }
};

export default runWithFallback;
