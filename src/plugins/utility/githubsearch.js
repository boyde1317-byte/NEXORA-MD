/**
 * githubsearch.js — .githubsearch / .gbsearch <query> — GitHub repo search.
 *
 * Ported from luna-md/plugins/githubsearch.js. Uses global fetch (no
 * node-fetch in NX deps) against the same keyless dark-core-api endpoint.
 * Reply shape and thumbnail image kept from the original.
 */

export default {
  name: 'githubsearch',
  aliases: ['gbsearch'],
  category: 'utility',
  description: 'Search GitHub repositories. Usage: .githubsearch <repo name>',
  cooldown: 3000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) return await m.reply(`⚠️ Please enter the name of a GitHub repository.\n\nExample: ${prefix || '.'}githubsearch NexoraFlex`);

    try {
      await m.react('🔍').catch(() => {});

      const api = `https://dark-core-api.vercel.app/api/search/github?key=api&text=${encodeURIComponent(query)}`;
      const res = await fetch(api, { signal: AbortSignal.timeout(15000) });
      const json = await res.json();

      if (!json.results || json.results.length === 0) {
        return await m.reply(`❌ No results found for: *${query}*`);
      }

      const result = json.results[0];
      const txt = [
        '*GITHUB - SEARCH*',
        '',
        `🍬 *Name:* ${result.name}`,
        `👑 *Owner:* ${result.creator}`,
        `🌟 *Stars:* ${result.stars}`,
        `🔖 *Forks:* ${result.forks}`,
        `📜 *Description:* ${result.description || 'No description'}`,
        `📆 *Created:* ${result.createdAt}`,
        `🔗 *Link:* ${result.cloneUrl}`,
      ].join('\n');

      const img = 'https://files.catbox.moe/oc4myc.png';
      await sock.sendMessage(m.from, { image: { url: img }, caption: txt }, { quoted: m })
        .catch(async () => { await m.reply(txt); });
      await m.react('✅').catch(() => {});
    } catch (err) {
      console.error('[githubsearch]', err.message);
      await m.reply(`❌ Error: ${err.message}`);
      await m.react('✖️').catch(() => {});
    }
  },
};
