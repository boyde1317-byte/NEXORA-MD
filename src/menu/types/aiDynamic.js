import { getGreeting, divider } from '../formatter.js';
import { db } from '../../database/db.js';
import { imageManager } from '../../images/imageManager.js';

const THEMES = [
  { name: '🌌 COSMIC SLATE', prefix: '✦', suffix: '✦', color: 'indigo' },
  { name: '⚡ CYBERPUNK NEON', prefix: '🤖', suffix: '⚡', color: 'yellow' },
  { name: '🟢 MATRIX DIGITAL', prefix: '📟', suffix: '🔌', color: 'green' },
  { name: '🔥 VOLCANIC CRIMS', prefix: '🌋', suffix: '🔥', color: 'red' },
  { name: '💎 DIAMOND GLOW', prefix: '✨', suffix: '💎', color: 'cyan' }
];

export const aiDynamicMenu = {
  id: 12,
  name: 'aiDynamic',
  description: 'AI-Dynamic system with auto-theming, command rankings, and user stats',
  supportedMessages: ['extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(12);

    // 1. Pick a random design theme for visual variety
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

    // 2. Compute true dynamic command ranking from database metrics
    const stats = db.data.stats?.commandsUsed || {};
    const ranking = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    let rankingText = '';
    if (ranking.length > 0) {
      rankingText = ranking.map(([name, count], i) => `  ${i + 1}. \`${name}\` (${count} runs)`).join('\n');
    } else {
      rankingText = '  _No commands recorded yet._';
    }

    // 3. User & Group specific contextual statistics
    const userDb = db.getUser(m.sender);
    const totalUserTriggers = userDb?.warnCount || 0; // standard mock hook, or warn count
    const isGroup = m.isGroup;
    const groupDb = isGroup ? db.getGroup(m.from) : null;

    // 4. Compile the full themed AI dashboard layout
    let text = `${theme.prefix} *${theme.name}* ${theme.suffix}\n`;
    text += `_${getGreeting()}, @${m.senderNumber}!_\n`;
    text += `${divider}\n\n`;

    text += `📈 *DYNAMIC INSIGHTS & RANKINGS*\n`;
    text += `• *Most Active Commands:*\n${rankingText}\n`;
    text += `• *User Rank:* ${userDb?.premium ? '⭐ Premium Account' : '👤 Standard Account'}\n`;
    if (isGroup) {
      text += `• *Group Status:* ${groupDb?.mute ? '🔇 Muted' : '🔊 Listening'}\n`;
    }
    text += `• *System Load:* Normal | Latency: ~120ms\n\n`;

    text += `📂 *AVAILABLE MODULES*\n`;
    const categories = Object.keys(menuData.categories).sort();
    for (const cat of categories) {
      const list = menuData.categories[cat].map(c => `\`${c.name}\``).join(', ');
      text += `↳ *${cat.toUpperCase()}*: ${list}\n`;
    }

    text += `\n${divider}\n`;
    text += `⏰ *Uptime:* \`${menuData.uptime}\` | 🟢 *Vibe:* Optimal`;

    return await sock.sendMessage(m.from, {
      text,
      mentions: [m.sender]
    }, { quoted: m });
  }
};

export default aiDynamicMenu;
