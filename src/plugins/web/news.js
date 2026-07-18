/**
 * news.js — Latest news articles.
 *
 * Upgraded from copyResultCard → carousel (one card per article with source
 * URL button) with copyResultCard fallback for all article links.
 */
import { Providers } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';
import { baileysBridge } from '../../core/baileysBridge.js';

export default {
  name: 'news',
  category: 'web',
  description: 'Get the latest news articles.',
  cooldown: 10000,
  execute: async ({ m, sock, args, prefix }) => {
    const p     = prefix || '.';
    const query = args.join(' ');

    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        return await m.reply.error('NEWS_API_KEY is not configured in environment variables.');
      }

      const result = await Providers.news(query, apiKey);
      if (!result.articles?.length) {
        return await m.reply.info('No news articles found for that topic.', 'NEWS');
      }

      const articles = result.articles.slice(0, 8);

      // ── Tier 1: carousel — one card per article ──────────────────────
      try {
        const cards = articles.map((a, idx) => ({
          caption:    `📰 *${a.title}*\n\n_${a.source?.name || 'Unknown Source'}_\n\n${(a.description || '').slice(0, 100)}${a.description?.length > 100 ? '…' : ''}`,
          footer:     `Article ${idx + 1} of ${articles.length}`,
          nativeFlow: [
            { text: '🔗 Read Full Article', url: a.url },
          ],
          ...(a.urlToImage ? { image: { url: a.urlToImage } } : {}),
        }));

        return await baileysBridge.sendCarousel(sock, m.from, {
          text: query
            ? `📰 *NEWS: ${query.toUpperCase()}* — ${articles.length} articles`
            : `📰 *TOP HEADLINES* — ${articles.length} articles`,
          cards,
        }, { quoted: m });
      } catch (err) {
        console.warn('[news] Tier 1 (carousel) failed, copyResultCard fallback:', err.message);
      }

      // ── Tier 2: copyResultCard with all links ────────────────────────
      let text = `📰 *${query ? `NEWS: ${query.toUpperCase()}` : 'TOP HEADLINES'}*\n\n`;
      articles.forEach((a, i) => {
        text += `*${i + 1}. ${a.title}*\n_${a.source?.name || 'Unknown'}_ — ${a.description || ''}\n🔗 ${a.url}\n\n`;
      });

      await copyResultCard(sock, m.from, {
        text:       text.trim(),
        footer:     'Powered by NewsAPI • NEXORA Web',
        copyLabel:  '📋 Copy All Links',
        copyValue:  articles.map(a => a.url).join('\n'),
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to fetch news: ${err.message}`);
    }
  }
};
