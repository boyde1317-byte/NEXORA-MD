/**
 * server2.js — .server2 — server / bot status.
 *
 * Ported from the LUNA MD server plugin (luna-md/plugins/server.js).
 * The original delivered its stats inside a relayed eventMessage
 * carrying a hardcoded stanza id, a hardcoded participant LID, a
 * Bandung (Indonesia) location, and fixed start/end times — all junk
 * from a pasted example. None of that is carried over: the stats are
 * sent as a plain-text reply, which is what actually renders. All
 * numbers are still measured live (response speed, uptimes, CPU,
 * load, RAM, Node version). Bot name rebranded to NEXORA MD.
 *
 * Why server2 and not server: NexoraFlex already ships
 * src/plugins/general/server.js (.server), so this one stays separate
 * and the existing command is untouched.
 */
import os from 'os';
import { performance } from 'perf_hooks';

export default {
  name: 'server2',
  aliases: [],
  category: 'general',
  description: 'Show live server and bot status (uptime, CPU, RAM, Node).',
  cooldown: 3000,
  execute: async ({ m }) => {
    const old = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const speed = (performance.now() - old).toFixed(2);

    const uptimeBot = clockString(process.uptime() * 1000);
    const uptimeServer = clockString(os.uptime() * 1000);
    const totalmem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const freemem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const usedmem = (totalmem - freemem).toFixed(1);
    const cpus = os.cpus()[0]?.model || 'Unknown';
    const platform = os.platform();
    const arch = os.arch();
    const nodev = process.version;
    const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
    const heap = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);

    const teks = `🏓 Response Speed: ${speed}ms
⏱️ Bot Uptime: ${uptimeBot}
🌐 Server Uptime: ${uptimeServer}
💻 System: ${platform} • Node ${nodev}
🧬 Kernel: ${os.release()} • ${arch}
🖥️ CPU: ${cpus}
📊 Load: ${os.loadavg().map((v) => v.toFixed(2)).join(' ')}
🧠 Bot RAM: ${ramUsage}MB • Heap: ${heap}MB
🗄️ Server RAM: ${usedmem}GB / ${totalmem}GB
💾 Copyright: NEXORA MD`;

    await m.reply(teks);
  },
};

function clockString(ms) {
  const h = Number.isNaN(ms) ? '--' : Math.floor(ms / 3600000);
  const m = Number.isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = Number.isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
