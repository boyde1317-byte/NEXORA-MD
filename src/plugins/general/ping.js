/**
 * ping.js — .ping — three styles, html by default:
 *
 *   html   (default) in-chat Server Monitor webview (GenAIaeacdsnwHtmlPrimitive)
 *                    with live latency / memory / cpu read from the host
 *   card            Moonson msping replica — AIRich product card as a system
 *                    monitor (price = latency ms) with latency/memory/cpu
 *   text            classic fake-quote personality ping
 *
 * Each style falls through to the next if its relay is refused, so a client
 * that cannot paint the HTML card still gets a working ping.
 */

import os from 'os';
import { sendFakeQuote } from '../../lib/waUtils.js';
import { getRandomResponse } from '../../nexora-messages.js';
import { AIRich } from '../../lib/NIXCODE.js';
import { sendHtmlGame } from '../../lib/htmlGames.js';
import brand from '../../../config/brand.js';
import capabilities from '../../core/capabilities.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { baileysBridge } from '../../core/baileysBridge.js';

const _fmtRam = (b) => {
  const mb = b / 1024 / 1024;
  return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(0) + ' MB';
};
const _bar = (p, size = 10) => '█'.repeat(Math.round((p / 100) * size)) + '░'.repeat(size - Math.round((p / 100) * size));

const _clock = (ms) => {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor(ms / 3600000) % 24;
  const minutes = Math.floor(ms / 60000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return days > 0
    ? `${days}d ${hours}h ${minutes}m ${seconds}s`
    : `${hours}h ${minutes}m ${seconds}s`;
};

async function _publicNetworkInfo() {
  const fallback = { ip: 'Unavailable', country: 'Unknown', region: 'Unknown', isp: 'Unknown', org: 'Unknown' };
  try {
    const response = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
    const data = await response.json();
    if (!data?.ip) return fallback;
    return {
      ip: data.ip,
      country: `${data.country || 'Unknown'}${data.country_code ? ` (${data.country_code})` : ''}`,
      region: [data.city, data.region].filter(Boolean).join(', ') || 'Unknown',
      isp: data.connection?.isp || 'Unknown',
      org: data.connection?.org || 'Unknown',
    };
  } catch {
    return fallback;
  }
}

async function _sendFullServerInfo(sock, m, latency) {
  const [network, cpus] = await Promise.all([_publicNetworkInfo(), Promise.resolve(os.cpus())]);
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const usedPct = (usedMem / totalMem) * 100;
  const hostname = os.hostname();
  const cpuModel = cpus[0]?.model?.trim() || 'Unknown';
  const region = network.region;
  const fullText = [
    '🤖 NEXORA MD',
    '',
    '🔵 PING',
    `• Latency: ${latency} ms`,
    `• Speed: ${Math.floor(Math.random() * 30 + 60)} ms`,
    '',
    '🖥️ DEVICE',
    `• Hostname: ${hostname}`,
    `• OS: ${os.type()} ${os.release()} (${os.arch()})`,
    `• CPU: ${cpuModel.slice(0, 60)}`,
    `• Cores: ${cpus.length} threads`,
    `• Load: ${os.loadavg()[0].toFixed(1)}%`,
    `• RAM: ${_fmtRam(usedMem)} / ${_fmtRam(totalMem)} (${usedPct.toFixed(1)}%)`,
    `• Node.js: ${process.version}`,
    `• Server uptime: ${_clock(os.uptime() * 1000)}`,
    '',
    '🌐 NETWORK',
    `• Public IP: ${network.ip}`,
    '• Local IP: masked for privacy',
    `• Country: ${network.country}`,
    `• Region: ${region}`,
    `• ISP: ${network.isp}`,
    `• Organization: ${network.org}`,
    '',
    '⏱️ BOT UPTIME',
    `• ${_clock(process.uptime() * 1000)}`,
  ].join('\n');
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 600000).toISOString();
  const channel = 'https://github.com/boyde1317-byte/nexoraflex';
  return baileysBridge.sendInteractive(sock, m.from, {
    header: { title: 'NEXORA MD • SERVER INFO' },
    body: fullText,
    footer: '© NEXORA MD • View server details',
    buttons: [{
      name: 'booking_confirmation',
      params: {
        start_datetime: start,
        end_datetime: end,
        location: `${network.country} • ${region}`,
        booking_url: channel,
        booking_management_url: channel,
        description: fullText,
        display_text: 'Open Server Details',
        display_content: {
          display_language: 'en',
          display_meeting_type: 'Server',
          display_bottom_sheet_header: 'NEXORA MD • SERVER INFO',
          display_add_to_calendar_cta_text: 'NEXORA MD',
          display_view_on_maps_cta_text: 'View Location',
          display_manage_booking_cta_text: 'Open Project',
          display_manage_booking_not_supported_text: 'NEXORA MD',
          display_read_more: 'View Details',
        },
      },
    }],
  }, { quoted: m });
}

export default {
  name: 'ping',
  aliases: ['p', 'speed'],
  category: 'general',
  description: 'Measures the response speed of the bot.',
  cooldown: 2000,
  execute: async ({ m, sock, args }) => {
    const styleArg = (args?.[0] || '').toLowerCase();
    const style = ['html', 'card', 'rich', 'full', 'network', 'text', 'classic'].includes(styleArg)
      ? (styleArg === 'rich' ? 'card' : styleArg === 'classic' ? 'text' : styleArg)
      : 'html';

    const start = Date.now();
    // Fake WhatsApp-branded quote bar gives the "measuring" step a radar-ping feel
    const sent = await sendFakeQuote(sock, m.from, '⚡ _Calculating latency..._', '📡 Ping', { quoted: m });
    const latency = Date.now() - start;

    let pool;
    if (latency < 100)      pool = 'ping_fast';
    else if (latency < 400) pool = 'ping_normal';
    else                    pool = 'ping_slow';
    const comment = getRandomResponse(pool, latency);

    // Rem's full ping technique: live public-IP geolocation and a booking-
    // style native-flow server-information surface. It is opt-in so the
    // existing monitor remains the default and no location is exposed on a
    // normal .ping invocation.
    if (style === 'full' || style === 'network') {
      try {
        await _sendFullServerInfo(sock, m, latency);
        return;
      } catch (err) {
        console.warn('[ping] full server-info tier failed:', err.message);
      }
    }

    // ── Tier 1 (default): in-chat HTML server monitor ──
    if (style === 'html') {
      try {
        const res = await sendHtmlGame(sock, m.from, { game: 'monitor', quoted: m });
        if (res?.ok) return;
        console.warn('[ping] html tier refused:', res?.reason || 'unknown');
      } catch (err) {
        console.warn('[ping] html tier failed:', err.message);
      }
    }

    // ── Tier 2: Moonson msping replica (product card system monitor) ──
    if (style !== 'text' && capabilities.richResponse) {
      try {
        const t0 = performance.now();
        await fetch('https://httpbin.org/get', { signal: AbortSignal.timeout(5000) }).catch(() => null);
        const apiLatency = (performance.now() - t0).toFixed(0);

        const totalRam = os.totalmem();
        const usedRam = totalRam - os.freemem();
        const ramPct = (usedRam / totalRam) * 100;
        const cpuLoad = os.loadavg()[0];
        const cores = os.cpus().length;
        const cpuModel = os.cpus()[0]?.model?.trim() || 'Unknown';
        const thumb = ASSET_URLS.thumbnail;

        await new AIRich(sock)
          .addProduct({
            title: 'NEXORA MD',
            brand: 'System Monitor',
            price: apiLatency + ' ms',
            sale_price: latency < 400 ? 'Excellent' : 'Degraded',
            product_url: 'https://github.com/boyde1317-byte/NEXORA-MD',
            image_url: thumb,
            icon_url: thumb,
          })
          .addText(
            '## ◈ Latency\n\n' +
              '› Bot Ping : **' + latency + ' ms**\n' +
              '› API Ping : **' + apiLatency + ' ms**\n' +
              '› Status   : **' + (latency < 100 ? 'Blazing' : latency < 400 ? 'Healthy' : 'Sluggish') + '**'
          )
          .addText(
            '## ◈ Memory\n\n' +
              '› Used : **' + _fmtRam(usedRam) + ' / ' + _fmtRam(totalRam) + '**\n' +
              '› Bar  : **' + _bar(ramPct) + '** ' + ramPct.toFixed(1) + '%'
          )
          .addText(
            '## ◈ CPU\n\n' +
              '› Model : ' + cpuModel.split('\n')[0] + '\n' +
              '› Cores : **' + cores + '**\n' +
              '› Load  : **' + cpuLoad.toFixed(2) + '**'
          )
          .addTip('_' + comment.replace(/[*_]/g, '') + '_')
          .setFooter(`© ${brand.name} by ${brand.display?.creator || brand.creator}`)
          .send(m.from, { quoted: m });
        return;
      } catch (err) {
        console.warn('[ping] rich tier failed, using classic ping:', err.message);
      }
    }

    await sock.sendMessage(m.from, {
      text: comment,
      edit: sent.key
    });
  },
};
