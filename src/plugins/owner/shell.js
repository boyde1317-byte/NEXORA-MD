/**
 * shell.js — .shell <cmd> / .$ <cmd> — run a shell command (owner only).
 *
 * Ported from LUNA MD plugins/owner-exec2.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; owner gating via
 *     `permissions: { owner: true }` instead of handler.owner.
 *   - The LUNA original ran on a bare `$ ` custom prefix with no bot
 *     prefix and edited its own "Executing..." message in place
 *     (m.edit). NexoraFlex has no customPrefix hook or m.edit, so this
 *     runs as a normal command: `.shell <cmd>` (alias `.$ <cmd>`).
 *     The bare `$ <cmd>` trigger from LUNA does NOT work here.
 *   - 30 s timeout, 2 MB output cap, stdout/stderr truncated to 4000
 *     chars each so a runaway command can't flood the chat.
 *   - The `global.conn.user.jid != conn.user.jid` sub-bot guard is gone:
 *     NexoraFlex runs a single socket.
 *
 * Kept deliberately: owner-only shell exec is the point of this command.
 */
import cp, { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec).bind(cp);
const MAX_OUT = 4000;

const trim = (s) => {
  const t = String(s || '').trim();
  return t.length > MAX_OUT ? `${t.slice(0, MAX_OUT)}\n…(truncated)` : t;
};

export default {
  name: 'shell',
  aliases: ['$'],
  category: 'owner',
  description: 'Run a shell command on the host (owner only). Usage: .shell <command>',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, args }) => {
    const cmd = args.join(' ').trim();
    if (!cmd) return await m.reply.error('Usage: `.shell <command>`');
    await m.reply('Executing...');
    try {
      const { stdout, stderr } = await exec(cmd, { timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
      if (stdout.trim()) await m.reply(trim(stdout));
      if (stderr.trim()) await m.reply(`stderr:\n${trim(stderr)}`);
      if (!stdout.trim() && !stderr.trim()) await m.reply('(no output)');
    } catch (e) {
      const out = trim(e.stdout || '');
      const err = trim(e.stderr || e.message || '');
      if (out) await m.reply(out);
      if (err) await m.reply(`Error:\n${err}`);
      if (!out && !err) await m.reply('Command failed with no output.');
    }
  },
};
