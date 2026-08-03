/**
 * pinterest.js — Pinterest image search + direct download.
 *
 * Improvements:
 *  - DownloadProgress feedback
 *  - Error handling with user-friendly message
 *  - Direct image send to chat (not just links) — user gets actual images
 *  - Configurable result count: .pinterest <query> <count> (default 6, max 10)
 *  - Carousel of images, with per-image "Open Pin" buttons
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { pinterestSearch } from '../../lib/downloader.js';
import { DownloadProgress } from '../../lib/progress.js';

const DEFAULT_COUNT = 6;
const MAX_COUNT = 10;

export default {
  name: 'pinterest',
  aliases: ['pin', 'pindl'],
  category: 'download',
  description: 'Searches Pinterest and sends images directly. Usage: .pinterest <query> [count]',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';

    // Parse: last arg may be a count number
    let query = args.join(' ').trim();
    let count = DEFAULT_COUNT;

    const countMatch = query.match(/\s+(\d+)\s*$/);
    if (countMatch) {
      count = Math.min(parseInt(countMatch[1], 10), MAX_COUNT);
      query = query.replace(/\s+\d+\s*$/, '').trim();
    }

    if (!query) {
      return await m.reply.info(
        `Usage: \`${p}pinterest <search query> [count]\`\n\nExample: \`${p}pinterest minimalist wallpaper 3\`\nDefault: ${DEFAULT_COUNT} results (max ${MAX_COUNT})`,
        'PINTEREST SEARCH'
      );
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start(`Searching Pinterest for "${query}"`);
      try {
        const results = (await pinterestSearch(query)).slice(0, count);
        await progress.done(`✅ Found ${results.length} images. Sending...`);

        // Try carousel first (with open-pin links)
        const cards = results.map((pin, idx) => ({
          caption: `📌 *${(pin.title || 'Pinterest Image').slice(0, 80)}*`,
          footer: `Result ${idx + 1} of ${results.length}`,
          nativeFlow: [{ text: '🔗 Open Pin', url: pin.pinUrl }],
          image: { url: pin.image },
        }));

        try {
          await baileysBridge.sendCarousel(sock, m.from, {
            text: `📌 *Pinterest results for:* "${query}"`,
            cards,
          }, { quoted: m });
        } catch (err) {
          console.warn('[pinterest] carousel failed, sending images individually:', err.message);
          // Fallback: send each image directly to chat
          for (const pin of results) {
            try {
              await sock.sendMessage(m.from, {
                image: { url: pin.image },
                caption: pin.title || '',
              }, { quoted: m });
            } catch (imgErr) {
              console.warn('[pinterest] failed to send image:', imgErr.message);
            }
          }
        }

        // Follow-up card
        try {
          await mixedCard(sock, m.from, {
            text: `✅ *Sent ${results.length} Pinterest images for "${query}"*`,
            footer: 'NEXORA-MD • Pinterest',
          }, [
            { kind: 'action', label: '🔄 Search Again', cmd: `${p}pinterest ${query} ${count}` },
            { kind: 'action', label: '📸 Instagram',    cmd: `${p}ig` },
          ], { quoted: m });
        } catch (_) {}
      } catch (err) {
        await progress.fail(`❌ Pinterest search failed: ${err.message}`);
      }
    });
  }
};
