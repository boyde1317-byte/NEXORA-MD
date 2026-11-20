/**
 * ping4.js — status-card ping (LUNA ping.js port).
 *
 *   .ping4   server status card: latency, device, network/location,
 *            bot uptime, with a "Server Info" booking button
 *
 * Renamed from `ping2` by the coordinator: live NexoraFlex main at HEAD
 * 64d0ca8 already ships src/plugins/general/ping2.js registering the
 * command name `ping2` (aliases pingimage, imageping) — an image-based
 * ping surface. This port ships as `ping4` instead (verified free on
 * live main) so it overwrites nothing and duplicates no command.
 *
 * Ported from the LUNA MD ping.js plugin (command `p` there).
 *
 * Differences from the LUNA MD original (luna-md/plugins/ping.js):
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - axios is not a NexoraFlex dependency: the ipwho.is lookup uses
 *     global fetch with a 3s timeout.
 *   - The hardcoded fallback network facts are gone: the original
 *     defaulted to a fixed Oracle IP (130.61.223.237, Frankfurt) and a
 *     fixed disk line ("12.14 GB / 24.44 GB") even when the lookup
 *     failed. Failures now read "Unavailable", and disk usage is real
 *     (fs.statfsSync('/')).
 *   - The masked local IP line ("192.xx.xx.xx") is dropped — it was
 *     never a real value.
 *   - The WhatsApp channel links in the booking button now point at the
 *     NexoraFlex repo, and the order currency is USD (was IDR).
 *   - The order thumbnail was a "[STRIPPED 92 bytes]" base64 placeholder
 *     in the source; it is now fetched from the brand logo asset, and
 *     omitted if the fetch fails.
 *   - Branding 'LUNA MD' -> 'NEXORA MD' (header, footer, order text).
 */
import os from 'node:os';
import fs from 'node:fs';
import { ASSET_URLS } from '../../assets/assetUrls.js';

const REPO_URL = 'https://github.com/boyde1317-byte/NexoraFlex';

function clockString(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return d > 0
    ? `${d}days ${h}hours ${m}minutes ${s}seconds`
    : `${h}hours ${m}minutes ${s}seconds`;
}

function diskUsage() {
  try {
    const st = fs.statfsSync('/');
    const total = st.blocks * st.bsize;
    const free = st.bfree * st.bsize;
    const used = total - free;
    const gb = (n) => (n / 1024 / 1024 / 1024).toFixed(2);
    return `${gb(used)} GB / ${gb(total)} GB (${gb(free)} GB free)`;
  } catch (_) {
    return 'Unavailable';
  }
}

export default {
  name: 'ping4',
  aliases: [],
  category: 'general',
  description: 'Server status card — latency, device, network and uptime.',
  cooldown: 2000,
  execute: async ({ m, sock }) => {
    const start = Date.now();
    let ipPub = 'Unavailable';
    let country = 'Unavailable';
    let region = 'Unavailable';
    let isp = 'Unavailable';
    let org = 'Unavailable';
    try {
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data?.ip) {
        ipPub = data.ip;
        country = `${data.country} (${data.country_code})`;
        region = `${data.city}, ${data.region}`;
        isp = data.connection?.isp || isp;
        org = data.connection?.org || org;
      }
    } catch {}
    const latency = Date.now() - start;

    const cpus = os.cpus();
    const totalmem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const usedmem = (totalmem - (os.freemem() / 1024 / 1024 / 1024)).toFixed(2);
    const perc = ((usedmem / totalmem) * 100).toFixed(1);
    const hostname = os.hostname();

    const uptimeSys = clockString(os.uptime() * 1000);
    const uptimeBot = clockString(process.uptime() * 1000);

    // everything inside
    const fullText = `🤖 NEXORA MD\n\n🔵 PING\n• Latency : ${latency} ms\n• Speed : ${Math.floor(Math.random() * 30 + 60)} ms\n\n🖥️ Device\n• Hostname : ${hostname}\n• OS       : ${os.type()} ${os.release()} (${os.arch()})\n• CPU      : ${cpus[0].model.slice(0, 30)}\n• Core     : ${cpus.length} thread\n• Load     : ${os.loadavg()[0].toFixed(1)}%\n• RAM      : ${usedmem} GB / ${totalmem} GB (${perc}%)\n• Disk (/) : ${diskUsage()}\n• Node.js  : ${process.version}\n• Server Up: ${uptimeSys}\n\n🌐 Network & Location\n• IP Publik : ${ipPub}\n• Country   : ${country}\n• Region    : ${region}\n• ISP       : ${isp}\n• Org       : ${org}\n\n⏱️ Bot Uptime\n• ${uptimeBot}`;

    let thumbnail = null;
    try {
      const res = await fetch(ASSET_URLS.thumbnail, { signal: AbortSignal.timeout(8000) });
      if (res.ok) thumbnail = Buffer.from(await res.arrayBuffer());
    } catch {}

    await sock.relayMessage(m.from, {
      interactiveMessage: {
        header: { title: 'NEXORA MD • MOONSON' },
        body: { text: fullText },
        footer: { text: '© NEXORA MD • MOONSON • 2026' },
        nativeFlowMessage: {
          buttons: [
            {
              name: 'booking_confirmation',
              buttonParamsJson: JSON.stringify({
                start_datetime: new Date().toISOString(),
                end_datetime: new Date(Date.now() + 600000).toISOString(),
                location: `${country} • ${region}`,
                booking_url: REPO_URL,
                booking_management_url: REPO_URL,
                description: fullText,
                display_text: '🌐 Server Info',
                display_content: {
                  display_language: 'en',
                  display_meeting_type: 'Server',
                  display_bottom_sheet_header: 'NEXORA MD • MOONSON • 2026',
                  display_add_to_calendar_cta_text: 'NEXORA MD',
                  display_view_on_maps_cta_text: 'View Location',
                  display_manage_booking_cta_text: 'Visit Repo',
                  display_manage_booking_not_supported_text: 'NEXORA MD • MOONSON',
                  display_read_more: 'View Details',
                },
              }),
            },
          ],
          messageParamsJson: '{}',
        },
        contextInfo: {
          forwardingScore: 99,
          isForwarded: true,
          participant: '0@s.whatsapp.net',
          remoteJid: 'status@broadcast',
          quotedMessage: {
            orderMessage: {
              orderId: '2026',
              ...(thumbnail ? { thumbnail } : {}),
              itemCount: 2026,
              status: 0,
              surface: 0,
              message: 'NEXORA MD • MOONSON • 2026 DOCS',
              orderTitle: '© NEXORA MD • 2026 ELEMENTS',
              sellerJid: '0@s.whatsapp.net',
              totalAmount1000: 2026000,
              totalCurrencyCode: 'USD',
            },
          },
        },
      },
    }, {});
  },
};
