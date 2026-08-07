/**
 * @file src/plugins/owner/middleware.js
 *
 * .middleware — Shows registered pipeline middlewares, their priorities,
 * and current rate-limiter/cooldown status. Wraps the unused
 * src/handlers/middleware.js module as an owner-only diagnostic command.
 *
 * Also provides:
 *   .middleware reset    — clears the rate limiter map
 *   .middleware list     — same as bare .middleware (shows all)
 */

import { middlewareRegistry, rateLimiter } from '../../handlers/middleware.js';

export default {
  name:        'middleware',
  aliases:     ['mw', 'pipeline'],
  category:    'owner',
  description: 'Shows registered middleware pipeline and rate-limiter status.',
  cooldown:    2000,
  permissions:  { owner: true },

  execute: async ({ sock, m, args }) => {
    const sub = (args && args[0]) || '';

    // ── Sub-command: reset rate limiter ───────────────────────────────────
    if (sub === 'reset' || sub === 'clear') {
      rateLimiter.reset();
      return await sock.sendMessage(m.from, {
        text: `\u2705 Rate limiter map cleared.`,
      }, { quoted: m });
    }

    // ── Default: list all middlewares ─────────────────────────────────────
    const middlewares = middlewareRegistry.getMiddlewares();

    let output = `\u{1F527} *Middleware Pipeline* (${middlewares.length} registered)\n\n`;

    output += `\u2500\u2500 Registered Middlewares \u2500\u2500\n`;
    for (const mw of middlewares) {
      const bar = '\u2502'.padStart(2, ' ');
      output += `${bar} [${String(mw.priority).padStart(2, ' ')}] ${mw.name}\n`;
    }

    // ── Rate limiter stats ─────────────────────────────────────────────────
    output += `\n\u2500\u2500 Rate Limiter \u2500\u2500\n`;
    output += `Max: ${rateLimiter.max} per ${rateLimiter.windowMs / 1000}s\n`;

    // Count tracked users in rate limit map
    const trackedUsers = rateLimiter.reset.length; // dummy — can't access Map directly
    // The rateLimitMap is module-scoped; we expose reset() but not the map itself.
    // Show config instead.
    output += `Window: ${rateLimiter.windowMs}ms\n`;

    // ── Help ───────────────────────────────────────────────────────────────
    output += `\n\u2500\u2500 Sub-commands \u2500\u2500\n`;
    output += `\u2022 .middleware reset \u2014 clear rate limiter map\n`;
    output += `\u2022 .middleware list \u2014 show this list\n`;

    await sock.sendMessage(m.from, { text: output }, { quoted: m });
  },
};
