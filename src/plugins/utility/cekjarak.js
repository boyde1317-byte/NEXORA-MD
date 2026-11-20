/**
 * cekjarak.js — .cekjarak (aliases .jarak, .rute, .maps, .distance,
 * .route) — route + distance between two places, with a hand-rendered
 * OpenStreetMap image (Nominatim geocoding + OSRM routing, keyless).
 *
 * Ported from the LUNA MD plugins/cekjarak.js. The map is rendered
 * pixel-by-pixel in pure JS (OSM tiles fetched, decoded, composited,
 * route line drawn, re-encoded as PNG) — no image library needed.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; axios replaced by global fetch
 *     (axios is not a direct NexoraFlex dependency).
 *   - The top4top.io upload is DROPPED: the rendered PNG buffer is
 *     sent directly as an image message instead of uploading it to a
 *     third-party host and linking it. Faster, and no throwaway host
 *     in the path.
 *   - The author's personal credits in the caption are dropped.
 *   - `conn.sendMessage` -> `sock.sendMessage` / `m.reply`;
 *     `m.chat` -> `m.from`.
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
import zlib from 'node:zlib';

const UA = 'NexoraMD/1.0 (WhatsApp bot; OSM tile usage policy compliant)';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const encodePng = (w, h, rgb) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * stride + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const decodePng = (buf) => {
  let pos = 8;
  let w;
  let h;
  let depth;
  let type;
  let interlace;
  let plte = null;
  let trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; type = data[9]; interlace = data[12];
    } else if (name === 'PLTE') plte = data;
    else if (name === 'tRNS') trns = data;
    else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
    pos += 12 + len;
  }
  if (interlace) throw new Error('Interlaced tile PNG not supported');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const bits = channels * depth;
  const bpp = Math.max(1, bits >> 3);
  const stride = Math.ceil((w * bits) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pix = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pix[y * stride + x - bpp] : 0;
      const b = y > 0 ? pix[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? pix[(y - 1) * stride + x - bpp] : 0;
      let v = raw[src + x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pix[y * stride + x] = v & 255;
    }
  }
  const sample = (y, i) => {
    const row = y * stride;
    if (depth === 8) return pix[row + i];
    if (depth === 16) return pix[row + i * 2];
    const bitPos = i * depth;
    return (pix[row + (bitPos >> 3)] >> (8 - depth - (bitPos & 7))) & ((1 << depth) - 1);
  };
  const scale = depth < 8 ? 255 / ((1 << depth) - 1) : 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (type === 3) {
        const i = sample(y, x);
        out[o] = plte[i * 3]; out[o + 1] = plte[i * 3 + 1]; out[o + 2] = plte[i * 3 + 2];
        out[o + 3] = trns && i < trns.length ? trns[i] : 255;
      } else if (type === 0 || type === 4) {
        const g = Math.round(sample(y, x * channels) * scale);
        out[o] = g; out[o + 1] = g; out[o + 2] = g;
        out[o + 3] = type === 4 ? sample(y, x * 2 + 1) : 255;
      } else {
        out[o] = sample(y, x * channels); out[o + 1] = sample(y, x * channels + 1); out[o + 2] = sample(y, x * channels + 2);
        out[o + 3] = type === 6 ? sample(y, x * 4 + 3) : 255;
      }
    }
  }
  return { w, h, rgba: out };
};

const proyeksi = (lon, lat, z) => {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
};

const haversine = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const lengkung = (a, b, n = 64) => {
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const vec = ({ lat, lon }) => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];
  const va = vec(a);
  const vb = vec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const w = Math.acos(dot);
  if (!w) return [[a.lon, a.lat], [b.lon, b.lat]];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const k1 = Math.sin((1 - t) * w) / Math.sin(w);
    const k2 = Math.sin(t * w) / Math.sin(w);
    const v = va.map((c, j) => k1 * c + k2 * vb[j]);
    return [deg(Math.atan2(v[1], v[0])), deg(Math.atan2(v[2], Math.hypot(v[0], v[1])))];
  });
};

async function buatPeta(a, b, koordinat, warnaGaris) {
  const W = 900;
  const H = 600;
  const pad = 70;
  const lons = koordinat.map((c) => c[0]);
  const lats = koordinat.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  let zoom = 17;
  let p1;
  let p2;
  while (zoom > 1) {
    p1 = proyeksi(minLon, maxLat, zoom); p2 = proyeksi(maxLon, minLat, zoom);
    if (p2[0] - p1[0] <= W - 2 * pad && p2[1] - p1[1] <= H - 2 * pad) break;
    zoom--;
  }
  p1 = proyeksi(minLon, maxLat, zoom); p2 = proyeksi(maxLon, minLat, zoom);
  const left = Math.round((p1[0] + p2[0]) / 2 - W / 2);
  const top = Math.round((p1[1] + p2[1]) / 2 - H / 2);
  const canvas = Buffer.alloc(W * H * 3, 233);
  const maxTile = 2 ** zoom;
  const headers = { 'User-Agent': UA };
  for (let ty = Math.floor(top / 256); ty <= Math.floor((top + H - 1) / 256); ty++) {
    for (let tx = Math.floor(left / 256); tx <= Math.floor((left + W - 1) / 256); tx++) {
      if (ty < 0 || ty >= maxTile) continue;
      try {
        const tileX = ((tx % maxTile) + maxTile) % maxTile;
        const r = await fetch(`https://tile.openstreetmap.org/${zoom}/${tileX}/${ty}.png`, { headers, signal: AbortSignal.timeout(15000) });
        if (!r.ok) continue;
        const tile = decodePng(Buffer.from(await r.arrayBuffer()));
        const ox = tx * 256 - left;
        const oy = ty * 256 - top;
        for (let y = 0; y < tile.h; y++) {
          const dy = oy + y;
          if (dy < 0 || dy >= H) continue;
          for (let x = 0; x < tile.w; x++) {
            const dx = ox + x;
            if (dx < 0 || dx >= W) continue;
            const s = (y * tile.w + x) * 4;
            const d = (dy * W + dx) * 3;
            const al = tile.rgba[s + 3] / 255;
            for (let k = 0; k < 3; k++) canvas[d + k] = Math.round(tile.rgba[s + k] * al + canvas[d + k] * (1 - al));
          }
        }
      } catch (_) { continue; }
    }
  }
  const mix = (x, y, warna, al) => {
    if (x < 0 || y < 0 || x >= W || y >= H || al <= 0) return;
    const o = (y * W + x) * 3;
    for (let k = 0; k < 3; k++) canvas[o + k] = Math.round(warna[k] * al + canvas[o + k] * (1 - al));
  };
  const garis = (pts, lebar, warna) => {
    const rad = lebar / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      const yMin = Math.max(0, Math.floor(Math.min(y1, y2) - rad - 1));
      const yMax = Math.min(H - 1, Math.ceil(Math.max(y1, y2) + rad + 1));
      const xMin = Math.max(0, Math.floor(Math.min(x1, x2) - rad - 1));
      const xMax = Math.min(W - 1, Math.ceil(Math.max(x1, x2) + rad + 1));
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
          const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
          mix(x, y, warna, Math.min(1, rad + 0.5 - d));
        }
      }
    }
  };
  const titik = ([cx, cy], rad, warna) => {
    for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad + 1); y++) {
      for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad + 1); x++) {
        mix(x, y, warna, Math.min(1, rad + 0.5 - Math.hypot(x - cx, y - cy)));
      }
    }
  };
  const layar = (lon, lat) => { const [px, py] = proyeksi(lon, lat, zoom); return [px - left, py - top]; };
  const jalur = koordinat.map(([lon, lat]) => layar(lon, lat));
  garis(jalur, 9, [255, 255, 255]); garis(jalur, 5, warnaGaris);
  titik(layar(a.lon, a.lat), 13, [255, 255, 255]); titik(layar(a.lon, a.lat), 9, [67, 160, 71]);
  titik(layar(b.lon, b.lat), 13, [255, 255, 255]); titik(layar(b.lon, b.lat), 9, [229, 57, 53]);
  return encodePng(W, H, canvas);
}

export default {
  name: 'cekjarak',
  aliases: ['jarak', 'rute', 'maps', 'distance', 'route'],
  category: 'utility',
  description: 'Route and distance between two places, with a rendered map. Usage: .cekjarak <origin> | <destination>',
  cooldown: 15000,
  execute: async ({ m, sock, args, prefix }) => {
    const input = args.join(' ');

    if (!input.includes('|')) {
      return await m.reply(`⚠️ Wrong format!\nExample: *${prefix}cekjarak Jakarta | Bandung*`);
    }

    const [asalInput, tujuanInput] = input.split('|').map((s) => s.trim());
    if (!asalInput || !tujuanInput) {
      return await m.reply('⚠️ Enter the origin and destination locations correctly!');
    }

    await m.reply('⏳ _Drawing the map and calculating the route, please wait a moment (manual rendering takes a little time)..._');

    const headers = { 'User-Agent': UA };
    const asal = asalInput;
    const tujuan = tujuanInput;

    try {
      const geo = async (q) => {
        const params = new URLSearchParams({ q, format: 'json', limit: '1' });
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers, signal: AbortSignal.timeout(20000) });
        const data = await r.json();
        if (!data.length) throw new Error(`City not found: ${q}`);
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), nama: data[0].display_name };
      };
      const a = await geo(asal);
      await new Promise((r) => setTimeout(r, 1100));
      const b = await geo(tujuan);
      const ambilDarat = async () => {
        try {
          const params = new URLSearchParams({ overview: 'simplified', geometries: 'geojson' });
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?${params}`, { signal: AbortSignal.timeout(20000) });
          const data = await res.json();
          return data.routes?.[0] || null;
        } catch (e) {
          if (e?.response?.data?.code === 'NoRoute') return null;
          throw e;
        }
      };
      const rute = await ambilDarat();
      const darat = Boolean(rute);
      const jarakUdara = haversine(a, b);
      const jarakKm = darat ? rute.distance / 1000 : jarakUdara;
      const durasi = darat ? rute.duration : Math.round((jarakUdara / 800 + 0.5) * 3600);
      const koordinat = darat ? rute.geometry.coordinates : lengkung(a, b);
      const jam = Math.floor(durasi / 3600);
      const menit = Math.round((durasi % 3600) / 60);
      let petaBuffer = null;
      let petaError;
      try {
        petaBuffer = await buatPeta(a, b, koordinat, darat ? [30, 136, 229] : [251, 140, 0]);
      } catch (e) { petaError = e.message; }
      const modeStr = darat ? '🚗 *Road (OSRM Routing)*' : '✈️ *Air (Straight Line)*';
      const waktuStr = jam ? `${jam} hours ${menit} minutes` : `${menit} minutes`;
      let caption = '📍 *ROUTE & DISTANCE INFO* 📍\n\n' +
        `🏢 *Origin:* ${a.nama}\n` +
        `🏁 *Destination:* ${b.nama}\n` +
        `🛣️ *Route:* ${modeStr}\n` +
        `📏 *Distance:* ${jarakKm.toFixed(1)} KM\n` +
        `⏳ *Estimated Time:* ${waktuStr}\n\n`;
      if (!darat) caption += '_Note: Air cruising speed estimate is 800 km/h, not a real flight route._\n\n';
      caption += '• NEXORA MD';
      if (petaBuffer) {
        await sock.sendMessage(m.from, { image: petaBuffer, caption }, { quoted: m });
      } else {
        caption = `⚠️ *Failed to render the map image:* ${petaError}\n\n${caption}`;
        await m.reply(caption);
      }
    } catch (e) {
      await m.reply(`❌ *Failed:* ${e.message}`);
    }
  },
};
