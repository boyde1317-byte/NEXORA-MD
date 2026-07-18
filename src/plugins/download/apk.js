import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard } from '../../lib/interactiveKit.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { apkSearch } from '../../lib/downloader.js';
import { formatSize } from '../../lib/utils.js';

const MAX_RESULTS = 6;

export default {
  name: 'apk',
  aliases: ['apkdl'],
  category: 'download',
  description: 'Searches for Android APKs. Usage: .apk <app name>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(
        `Usage: \`${prefix}apk <app name>\`\n\nExample: \`${prefix}apk whatsapp\``,
        'APK SEARCH'
      );
    }

    await withReactionStatus(m, async () => {
      const results = (await apkSearch(query)).slice(0, MAX_RESULTS);

      const cards = results.map((a, idx) => ({
        caption: `📱 *${a.name}*\n📦 ${a.packageName}\n💾 ${formatSize(a.size)}${a.version ? `\n🏷️ v${a.version}` : ''}`,
        footer: `Result ${idx + 1} of ${results.length} • Unofficial 3rd-party catalog`,
        nativeFlow: [{ text: '⬇️ Direct Download', url: a.url }],
        ...(a.icon ? { image: { url: a.icon } } : {}),
      }));

      try {
        await baileysBridge.sendCarousel(sock, m.from, {
          text: `📱 *APK results for:* "${query}"\n_Fetched from a third-party catalog (Aptoide) — verify before installing._`,
          cards,
        }, { quoted: m });
      } catch (err) {
        console.warn('[apk] carousel failed, falling back to table card:', err.message);
        await richTableCard(sock, m.from, {
          title: `📱 APK RESULTS: ${query}`,
          headers: ['App', 'Size', 'Package'],
          rows: results.map(a => [a.name, formatSize(a.size), a.packageName]),
          footer: 'Unofficial 3rd-party catalog — verify before installing.',
          buttons: results.slice(0, 3).map(a => ({ kind: 'url', label: `⬇️ ${a.name}`.slice(0, 24), url: a.url })),
        }, { quoted: m });
      }
    });
  }
};
