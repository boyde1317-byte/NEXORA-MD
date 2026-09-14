import { Providers } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';
import { getAiClient, hasApiKey } from '../../assets/aiClient.js';
import { sendLinkCard } from '../../lib/richContent.js';

export default {
  name: 'summary',
  aliases: ['summarize'],
  category: 'web',
  description: 'Summarize a webpage using AI or SMMRY.',
  cooldown: 15000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const url = args[0];
    if (!url || !url.startsWith('http')) {
      return await m.reply.info('Usage: `${p}summary <url>`', 'WEBPAGE SUMMARY');
    }
    
    await m.react('⏳');
    try {
      let resultText = '';
      
      if (hasApiKey()) {
        // Just fetch raw HTML
        const html = await fetch(url).then(r => r.text());
        const cleanText = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                              .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                              .replace(/<[^>]+>/g, ' ')
                              .replace(/\s+/g, ' ')
                              .slice(0, 15000);
        
        const ai = getAiClient();
        const res = await ai.models.generateContent({ 
          model: 'gemini-2.5-flash', 
          contents: `Summarize the following webpage content concisely in bullet points:\n\n${cleanText}` 
        });
        resultText = res.text;
      } else if (process.env.SMMRY_API_KEY) {
        const data = await Providers.summary(url);
        if (data.sm_api_error) throw new Error(data.sm_api_message);
        resultText = `*${data.sm_api_title}*\n\n${data.sm_api_content}`;
      } else {
        return await m.reply.error('No summarization service configured. Set GEMINI_API_KEY / GROQ_API_KEY (AI) or SMMRY_API_KEY.');
      }

      // ── Rich tier: native link card with source citations ──
      const pageTitle = (cleanText.slice(0, 60) || url).trim() || 'Source page';
      const linkSent = await sendLinkCard(sock, m.from, m, {
        text: resultText.replace(/\*+/g, '').slice(0, 3800),
        links: [{ url, displayName: 'Open source page' }],
        citations: [{ sourceTitle: pageTitle, sourceQuery: 'webpage summary', citationNumber: 1 }],
        footer: 'NEXORA • Summarizer',
      });
      if (linkSent) return;

      await copyResultCard(sock, m.from, {
        text: `📝 *SUMMARY*\n🔗 ${url}\n\n${resultText}`,
        footer: 'NEXORA • Summarizer',
        copyLabel: '📋 Copy Summary',
        copyValue: resultText
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to summarize: ${err.message}`);
    }
  }
};
