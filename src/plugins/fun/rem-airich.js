/**
 * rem-airich.js — compatibility command aliases for Rem's HTML Airich lab.
 *
 * Nexora already ships the device-tested HTML relay and vendored payloads, so
 * these commands reuse that production path instead of copying Rem's large
 * inline HTML strings. The user-facing command surface stays compatible.
 */
import { sendHtmlGame } from '../../lib/htmlGames.js';

const GAME_BY_COMMAND = {
  chess: 'chess',
  chess3d: 'chess',
  neonchess: 'chess',
  dino: 'dino',
  dinosaurus: 'dino',
  dinorun: 'dino',
  doom: 'doom',
  megumin: 'doom',
  doomstrike: 'doom',
  gd: 'geometry',
  geometry: 'geometry',
  dash: 'dashwide',
  piano: 'piano',
  pianogame: 'piano',
  composer: 'piano',
  pool: 'pool',
  billiard: 'pool',
  billiards: 'pool',
  biliar: 'pool',
  wide: 'pool',
  slot777: 'slots',
  tictactoe: 'ttc',
  tic: 'ttc',
  ttt: 'ttc',
};

export default {
  name: 'remairich',
  aliases: Object.keys(GAME_BY_COMMAND),
  category: 'games',
  description: 'Compatibility aliases for Rem Airich HTML games.',
  cooldown: 5000,
  execute: async ({ sock, m, commandName }) => {
    const command = String(commandName || '').toLowerCase();
    const game = GAME_BY_COMMAND[command];
    if (!game) return m.reply('Unknown Rem Airich game alias.');
    const result = await sendHtmlGame(sock, m.from, { game, quoted: m });
    if (!result?.ok) return m.reply(`The ${command} game is unavailable: ${result?.reason || 'unknown error'}`);
  },
};
