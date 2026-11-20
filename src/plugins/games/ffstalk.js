/**
 * ffstalk.js — .ffstalk — Free Fire profile stalk / nickname search.
 *
 * Ported from the LUNA MD commands/game/ffstalk.js, logic kept as-is
 * including the proof-of-work handshake the freefire.my.id API requires
 * (fetch a token + challenge, solve the PoW nonce, sign the request).
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `ctx.reply` -> `m.reply`,
 *     `ctx.args` -> `args` from the execute context.
 *   - The LUNA `permissions: { limit: true }` flag has no NexoraFlex
 *     equivalent (coin costs are handled centrally by the dispatcher),
 *     so it is dropped.
 *   - Branding: NEXORA MD.
 */
import { createHash } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';

const BASE = 'https://freefire.my.id';
const API = `${BASE}/api`;
const DEFAULT_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const RETRYABLE = new Set(['RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_ERROR', 'NETWORK_ERROR']);

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

class FreeFireError extends Error {
  constructor(message, { code = 'FREE_FIRE_ERROR', status = 0, cause } = {}) {
    super(message, { cause }); this.name = 'FreeFireError'; this.code = code; this.status = status;
  }
}

function buildHeaders(userAgent, extra = {}) {
  return {
    Accept: 'application/json',
    'Accept-Language': 'id-ID,id;q=0.9',
    Origin: BASE,
    Referer: `${BASE}/stalk`,
    'User-Agent': userAgent,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    ...extra,
  };
}

function solveProofOfWork(challenge, difficulty, { maxAttempts = 50000000 } = {}) {
  const prefix = '0'.repeat(Math.min(8, Math.max(1, Number(difficulty) || 4)));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const nonce = attempt.toString(36);
    if (sha256(`${challenge}:${nonce}`).startsWith(prefix)) return nonce;
  }
  throw new FreeFireError('Proof-of-work failed.', { code: 'POW_FAILED' });
}

function combineSignal(timeoutMs, signal) {
  try {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  } catch (_) { return signal; }
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (cause) {
    throw new FreeFireError('Not JSON', { code: 'INVALID_JSON', status: response.status, cause });
  }
}

function mapError(response, data) {
  const message = text(data.error) || `HTTP ${response.status}`;
  const codes = { 400: 'INVALID_INPUT', 401: 'HANDSHAKE_REJECTED', 403: 'BLOCKED', 404: 'NOT_FOUND', 429: 'RATE_LIMITED' };
  let code = codes[response.status];
  if (!code) {
    if (data.maintenance) code = 'UPSTREAM_UNAVAILABLE';
    else if (response.status >= 500) code = 'UPSTREAM_ERROR';
    else code = 'FREE_FIRE_ERROR';
  }
  return new FreeFireError(message, { code, status: response.status });
}

async function handshake(scope, { userAgent, signal, timeoutMs }) {
  const response = await fetch(`${API}/token?scope=${encodeURIComponent(scope)}`, {
    headers: buildHeaders(userAgent),
    signal: combineSignal(timeoutMs, signal),
  }).catch((cause) => { throw new FreeFireError('Failed to reach the API.', { code: 'NETWORK_ERROR', cause }); });
  const data = await readJson(response);
  if (!response.ok) throw mapError(response, data);
  const nonce = solveProofOfWork(data.challenge, data.difficulty);
  return {
    'x-fp-token': data.token,
    'x-fp-pow': nonce,
    'x-fp-sig': sha256(`${data.token}|${scope}|${nonce}`),
  };
}

async function callApi(scope, params, options) {
  const { userAgent = DEFAULT_UA, signal } = options;
  const timeoutMs = Number(options.timeoutMs) || 20000;
  const retries = Math.min(3, Math.max(0, Number(options.retries ?? 2)));
  const query = new URLSearchParams(params);
  let failure;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const headers = buildHeaders(userAgent, await handshake(scope, { userAgent, signal, timeoutMs }));
      const response = await fetch(`${BASE}${scope}?${query}`, {
        headers,
        signal: combineSignal(timeoutMs, signal),
      }).catch((cause) => { throw new FreeFireError('Request to the API failed.', { code: 'NETWORK_ERROR', cause }); });
      const data = await readJson(response);
      if (!response.ok) throw mapError(response, data);
      return data;
    } catch (error) {
      failure = error;
      if (!RETRYABLE.has(error.code) || attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw failure;
}

const failure = (error) => ({
  ok: false,
  service: 'freefire-stalk',
  why: error.message || 'Request failed.',
  code: error.code || 'FREE_FIRE_ERROR',
  status: error.status || 0,
});

async function freefireStalk(uid, options = {}) {
  const value = String(uid ?? '').trim();
  if (!/^\d{6,15}$/.test(value)) return { ok: false, why: 'UID must be 6-15 digits.', code: 'INVALID_INPUT' };
  try {
    const data = await callApi('/api/ff', { uid: value }, options);
    const player = data.player || {};
    return {
      ok: true,
      uid: text(data.meta?.uid) || value,
      nickname: text(player.nickname),
      region: text(player.region) || text(data.meta?.region),
      level: Number(player.level) || 0,
      rankingPoints: Number(player.rankingPoints) || null,
      liked: Number(player.liked) || 0,
      guild: data.guild && Object.keys(data.guild).length ? data.guild : null,
      credit: data.credit && Object.keys(data.credit).length ? data.credit : null,
      ban: data.ban && Object.keys(data.ban).length ? data.ban : null,
      character: player.equippedCharacter ? { name: player.equippedCharacter.name } : null,
      avatarUrl: player.equippedCharacterIconUrl || player.avatarUrl || null,
    };
  } catch (error) { return failure(error); }
}

async function freefireSearch(nickname, options = {}) {
  const value = text(nickname);
  if (value.length < 3) return { ok: false, why: 'Nickname must be at least 3 characters.', code: 'INVALID_INPUT' };
  try {
    const data = await callApi('/api/search', { q: value }, options);
    return {
      ok: true,
      results: (data.results || []).map((item) => ({
        uid: text(item.accountid ?? item.accountId ?? item.uid),
        nickname: text(item.nickname),
        region: text(item.region),
        level: Number(item.level) || 0,
      })),
    };
  } catch (error) { return failure(error); }
}

export default {
  name: 'ffstalk',
  aliases: [],
  category: 'games',
  description: 'Look up a Free Fire profile by UID, or find a UID by nickname. Usage: .ffstalk <UID or nickname>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const input = args.join(' ').trim();
    if (!input) {
      return await m.reply(
        '❌ Enter a Free Fire UID or Nickname!\nExample:\n' +
        `> \`${p}ffstalk 123456789\` (Stalk profile by UID)\n` +
        `> \`${p}ffstalk Evos\` (Find UID by Nickname)`,
      );
    }

    // If the input is only 6-15 digits, run the stalking
    if (/^\d{6,15}$/.test(input.trim())) {
      await m.reply(`🔍 *Looking up Free Fire profile UID:* ${input}...\n_Please wait, bypassing the API security..._`);
      const res = await freefireStalk(input);
      if (!res.ok) return await m.reply(`❌ Failed: ${res.why}`);

      let txt = '🎮 *FREE FIRE STALK*\n\n';
      txt += `👤 *Nickname:* ${res.nickname || 'No name'}\n`;
      txt += `🆔 *UID:* ${res.uid}\n`;
      txt += `📈 *Level:* ${res.level} | *Region:* ${res.region}\n`;
      txt += `🏆 *Ranking Pts:* ${res.rankingPoints ?? '-'}\n`;
      txt += `👍 *Likes:* ${res.liked}\n`;
      if (res.guild && res.guild.guildName) {
        txt += `🛡️ *Guild:* ${res.guild.guildName} (Lv ${res.guild.guildLevel || 1}) - ${res.guild.memberNum || 0}/${res.guild.capacity || 0} Member\n`;
      } else { txt += '🛡️ *Guild:* -\n'; }
      if (res.credit) txt += `💯 *Credit Score:* ${res.credit.creditScore}\n`;
      if (res.character) txt += `🦸 *Character:* ${res.character.name}\n`;
      if (res.ban) txt += `⚠️ *Status:* ${res.ban.isBanned ? `BANNED 🚫 (${res.ban.banPeriod || '?'})` : 'ACTIVE ✅'}\n`;

      // Send the avatar image if available
      if (res.avatarUrl) {
        return await sock.sendMessage(m.from, { image: { url: res.avatarUrl }, caption: txt }, { quoted: m });
      }
      return await m.reply(txt);
    }

    // If the input contains letters, run the nickname search
    await m.reply(`🔍 *Searching for Free Fire nickname:* ${input}...\n_Please wait, bypassing the API security..._`);
    const res = await freefireSearch(input);
    if (!res.ok) return await m.reply(`❌ Failed: ${res.why}`);
    if (!res.results || res.results.length === 0) return await m.reply(`❌ No player with nickname "${input}".`);

    let txt = `🔎 *Search Results: ${input}*\n\n`;
    // Limit to the first 15 results so the chat does not get spammed
    res.results.slice(0, 15).forEach((player, i) => {
      txt += `*${i + 1}. ${player.nickname}*\n`;
      txt += `┣ 🆔 UID: \`${player.uid}\`\n`;
      txt += `┗ 📈 Lv: ${player.level} | 🌍 Reg: ${player.region}\n\n`;
    });
    txt += `_Type ${p}ffstalk <UID> to see the account details along with its profile picture._`;
    return await m.reply(txt);
  },
};
