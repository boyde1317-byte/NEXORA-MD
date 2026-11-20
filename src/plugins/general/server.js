/**
 * server.js — Rem-compatible server status ping.
 *
 * This is intentionally separate from .ping and .stats: it focuses on the
 * short latency/uptime/host report that Rem exposes through .server and .m.
 * The unsupported eventMessage/location proto is represented by a reliable
 * AIRich card instead of hard-coded stale metadata.
 */
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { AIRich } from '../../lib/NIXCODE.js';
import brand from '../../../config/brand.js';

function clock(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export default {
  name: 'server',
  aliases: ['m', 'stat', 'infobot', 'serverstatus'],
  category: 'general',
  description: 'Shows the short server and bot status report.',
  cooldown: 2500,
  execute: async ({ sock, m }) => {
    const started = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const speed = (performance.now() - started).toFixed(2);
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    const processMem = process.memoryUsage();
    const cpu = os.cpus()[0]?.model?.trim() || 'Unknown';
    const load = os.loadavg().map((value) => value.toFixed(2)).join(' / ');
    const rows = [
      ['Response', `${speed} ms`],
      ['Bot uptime', clock(process.uptime() * 1000)],
      ['Server uptime', clock(os.uptime() * 1000)],
      ['Platform', `${os.platform()} ${os.arch()}`],
      ['Kernel', `${os.release()}`],
      ['CPU', cpu.slice(0, 70)],
      ['Load', load],
      ['Bot memory', `${Math.round(processMem.rss / 1024 / 1024)} MB RSS • ${Math.round(processMem.heapUsed / 1024 / 1024)} MB heap`],
      ['Server RAM', `${(usedMem / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB`],
      ['Node.js', process.version],
    ];
    return new AIRich(sock)
      .setTitle(`${brand.name || 'NEXORA MD'} • SERVER STATUS`)
      .addText(`## Server status\n\n**Online** — response measured locally at **${speed} ms**.`)
      .addTable([['Metric', 'Value'], ...rows])
      .addTip(`© ${brand.name || 'NEXORA MD'} • Live host diagnostics`)
      .setFooter('Server status • English diagnostics')
      .send(m.from, { quoted: m });
  },
};
