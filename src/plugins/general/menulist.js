import { menuManager } from '../../menu/manager.js';
import { scanCapabilities } from '../../core/baileysScanner.js';

/**
 * Lists all registered menu presentation styles with accurate compatibility status.
 *
 * Compatibility is determined by cross-referencing each style's `supportedMessages`
 * array against the live capability map from scanCapabilities(). Keys in that map
 * now match the WAProto message type strings used in supportedMessages, so
 * `capabilities[msgType] === false` fires correctly for genuinely unsupported types
 * (e.g. bottomSheetMessage) while leaving types not in the map (undefined) as
 * compatible (the `=== false` check never fires on undefined).
 *
 * Special cases surfaced to the user:
 *   - bottomSheetMessage → always false (not a proto type; uses nativeFlow optionText instead)
 *   - newsletterAdminInviteMessage → false if newsletter socket methods are absent
 *   - requestPaymentMessage / eventMessage → true at proto level, may no-op at WA server
 */
export default {
  name: 'menulist',
  aliases: ['styles', 'menus'],
  category: 'general',
  description: 'Lists all available menu presentation styles and their compatibility with this account.',
  cooldown: 2000,
  execute: async ({ sock, m, prefix }) => {
    // 1. Scan live socket capabilities (keys match supportedMessages strings)
    const caps = scanCapabilities(sock);

    // 2. Get registered styles
    const styles     = menuManager.getRegisteredMenus();
    const activeStyle = menuManager.getActiveMenu();

    let text = `🎨 *AVAILABLE BOT MENU STYLES*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `_Set your style with_ \`${prefix}setmenu <id_or_name>\`\n\n`;

    for (const style of styles) {
      const isActive = activeStyle && activeStyle.id === style.id;
      const activeTag = isActive ? ' 👑 *[ACTIVE]*' : '';

      // Compatibility: a style is incompatible only if one of its required
      // message types is explicitly `false` in the capability map.
      // `undefined` = not tracked = assume compatible (tier fallback handles it).
      const missing = (style.supportedMessages || []).filter(
        msgType => caps[msgType] === false
      );

      // Annotate types that are proto-level true but may silently no-op at WA server.
      const warned = (style.supportedMessages || []).filter(msgType =>
        msgType === 'requestPaymentMessage' || msgType === 'eventMessage'
      );

      const isIncompat = missing.length > 0;
      const hasWarning = warned.length > 0 && !isIncompat;

      const icon = isIncompat ? '🟡' : hasWarning ? '🟠' : '🟢';

      text += `${icon} *${style.id}. ${style.name.toUpperCase()}*${activeTag}\n`;
      text += `  ↳ ${style.description}\n`;

      if (isIncompat) {
        text += `  ↳ ⚠️ *Fallback mode* — missing: ${missing.join(', ')}\n`;
        // Add helpful note for the most common case
        if (missing.includes('bottomSheetMessage')) {
          text += `  ↳ _Note: Bottom sheet uses nativeFlow optionText (no separate proto type)._\n`;
        }
        if (missing.includes('newsletterAdminInviteMessage') || missing.includes('newsletterFollowerInviteMessage')) {
          text += `  ↳ _Note: Newsletter socket methods not detected on this connection._\n`;
        }
      } else if (hasWarning) {
        text += `  ↳ 🟠 *Account-gated* — proto supported; may silently no-op without a verified business account\n`;
      } else {
        text += `  ↳ ✅ Fully supported\n`;
      }

      text += '\n';
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🟢 Native  🟠 Account-gated  🟡 Fallback`;

    await m.reply(text);
  },
};
