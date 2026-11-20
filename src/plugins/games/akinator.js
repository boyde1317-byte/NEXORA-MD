/**
 * akinator.js — .akinator (aliases .tebakkarakter, .tebak, .karakter,
 * .mardbiru, .mard, .mared, .guesscharacter) — Akinator guessing game.
 *
 * Ported from the LUNA MD plugins/akinator.js ("MARD BIRU INDONESIA").
 * Think of a famous character; the bot asks yes/no questions via the
 * keyless mr-obito-api Akinator endpoints until it guesses who it is.
 * State lives in a module-level sessions map, keyed by chat+sender.
 *
 * Usage:
 *   .akinator            intro card (tap START)
 *   .akinator start      start a game
 *   .akinator yes | no | don't know | maybe | probably not
 *   .akinator back       go back one question
 *   .akinator delete     drop the session
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; axios replaced by global fetch.
 *   - Rebranded: "MARD BIRU INDONESIA" -> "AKINATOR", "LUNA MD &
 *     MOONSON" -> "NEXORA MD • MOONSON". The wa.me answer links now
 *     use the primary command `.akinator` instead of `.tebakkarakter`.
 *   - HTML scene follows the ping3.js INLINE pattern exactly: the
 *     shared VERIFICATION_SIGNATURE + certificate chain from
 *     src/assets/htmlgames/certificate.json, a fresh
 *     crypto.randomBytes(32) messageSecret and a fresh
 *     crypto.randomUUID() botResponseId per send, trusted_sources
 *     nexora.dev. The original shipped no messageSecret and no
 *     verification proofs at all. On relay failure it falls back to
 *     plain text instead of throwing.
 *   - No owner numbers, keys, or channel links.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from the ping3.js inline pattern.
const VERIFICATION_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';
const CERT_PATH = path.resolve(__dirname, '../../assets/htmlgames/certificate.json');
let certificateChainCache;
function loadCertificateChain() {
  if (certificateChainCache) return certificateChainCache;
  try {
    const raw = fs.readFileSync(CERT_PATH, 'utf-8');
    const chain = JSON.parse(raw);
    certificateChainCache = Array.isArray(chain) ? chain : [];
  } catch (_) {
    certificateChainCache = [];
  }
  return certificateChainCache;
}

const API = 'https://mr-obito-api.vercel.app/api';
const sessions = {};

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`API request failed (${res.status})`);
  return await res.json();
}

async function sendHtml(sock, chat, m, question, imgUrl, step, prog, isResult, resName, resDesc, isFirst) {
  const safeQ = question ? question.replace(/</g, '&lt;') : '';
  const safeName = resName ? resName.replace(/</g, '&lt;') : '';
  const safeDesc = resDesc ? resDesc.replace(/</g, '&lt;') : '';

  const html = `
<div style="width:100%;max-width:620px;margin:0 auto;font-family:Arial,sans-serif">
<div style="background:linear-gradient(135deg,#0f0c29,#302b63);border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.15)">
<div style="padding:14px 16px;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.1)">
<div style="display:flex;gap:10px;align-items:center"><div style="width:40px;height:40px;background:linear-gradient(135deg,#6c5ce7,#a29bfe);border-radius:10px;display:grid;place-items:center">🧞‍♂️</div><div><div style="font-size:10px;color:rgba(255,255,255,.5)">NEXORA MD • MOONSON</div><div style="font-size:14px;font-weight:900;color:#fff">AKINATOR</div></div></div>
<div style="background:rgba(0,0,0,.3);padding:6px 10px;border-radius:8px;text-align:center"><div style="font-size:9px;color:rgba(255,255,255,.5)">QUESTION</div><div style="font-size:18px;font-weight:900;color:#a29bfe">${isResult ? 'DONE' : (step + 1)}</div></div>
</div>
<div style="padding:12px 16px"><div style="height:6px;background:rgba(255,255,255,.1);border-radius:10px;overflow:hidden"><div style="height:100%;width:${prog}%;background:linear-gradient(90deg,#6c5ce7,#a29bfe)"></div></div><div style="font-size:10px;color:rgba(255,255,255,.4);text-align:right;margin-top:4px">${Math.floor(prog)}% Progress</div></div>
<div style="padding:0 16px 16px 16px">
${!isResult ? `
<div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;display:flex;gap:12px;align-items:center">
${imgUrl ? `<img src="${imgUrl}" style="width:85px;height:85px;border-radius:12px;object-fit:cover">` : `<div style="width:85px;height:85px;border-radius:12px;background:rgba(0,0,0,.3);display:grid;place-items:center;font-size:30px">🔮</div>`}
<div><div style="font-size:10px;color:#a29bfe;font-weight:800;margin-bottom:4px">AKINATOR ASKS</div><div style="font-size:14px;font-weight:700;color:#fff;line-height:1.4">${safeQ}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
<a href="https://wa.me/?text=.akinator yes" style="text-decoration:none;padding:12px;text-align:center;border-radius:12px;background:linear-gradient(135deg,#00b894,#00cec9);color:#fff;font-weight:900">✅ YES</a>
<a href="https://wa.me/?text=.akinator no" style="text-decoration:none;padding:12px;text-align:center;border-radius:12px;background:linear-gradient(135deg,#d63031,#ff7675);color:#fff;font-weight:900">❌ NO</a>
<a href="https://wa.me/?text=.akinator don't know" style="text-decoration:none;padding:12px;text-align:center;border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-weight:700;border:1px solid rgba(255,255,255,.15)">🤔 DON'T KNOW</a>
<a href="https://wa.me/?text=.akinator maybe" style="text-decoration:none;padding:12px;text-align:center;border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-weight:700;border:1px solid rgba(255,255,255,.15)">🤷 MAYBE</a>
<a href="https://wa.me/?text=.akinator probably not" style="text-decoration:none;grid-column:span 2;padding:12px;text-align:center;border-radius:12px;background:rgba(255,255,255,.06);color:#fff;font-weight:700">🤨 PROBABLY NOT</a>
</div>
<div style="display:flex;gap:8px;margin-top:10px">
<a href="https://wa.me/?text=.akinator start" style="flex:1;text-decoration:none;padding:14px;text-align:center;border-radius:12px;background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;font-weight:900">${isFirst ? '🎮 START GAME' : '🔄 RESTART'}</a>
<a href="https://wa.me/?text=.akinator back" style="text-decoration:none;padding:14px 12px;border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-weight:800">↩️</a>
<a href="https://wa.me/?text=.akinator delete" style="text-decoration:none;padding:14px 12px;border-radius:12px;background:rgba(255,99,99,.15);color:#ff7675;font-weight:800">🗑️</a>
</div>
` : `
<div style="background:linear-gradient(135deg,rgba(108,92,231,.3),rgba(0,206,201,.2));border:2px solid rgba(162,155,254,.5);border-radius:18px;padding:18px;text-align:center">
<div style="font-size:11px;color:#a29bfe;letter-spacing:2px;font-weight:900;margin-bottom:10px">🎉 I FOUND IT!</div>
<img src="${imgUrl}" style="width:150px;height:150px;border-radius:18px;object-fit:cover;border:3px solid #fff;margin:0 auto 12px auto;display:block">
<div style="font-size:22px;font-weight:900;color:#fff">${safeName}</div>
<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:8px;background:rgba(0,0,0,.25);padding:10px;border-radius:10px">${safeDesc}</div>
<a href="https://wa.me/?text=.akinator start" style="display:block;margin-top:14px;text-decoration:none;padding:14px;border-radius:12px;background:#fff;color:#302b63;font-weight:900;text-align:center">🔄 PLAY AGAIN</a>
</div>
`}
<div style="text-align:center;font-size:10px;color:rgba(255,255,255,.3);margin-top:12px">Akinator • NEXORA MD • MOONSON</div>
</div></div></div>`.trim();

  const responseId = crypto.randomUUID();
  const certificateChain = loadCertificateChain();
  const payload = {
    response_id: `akinator-nexora-${Date.now()}`,
    sections: [{
      view_model: {
        primitive: {
          __typename: 'GenAIaeacdsnwHtmlPrimitive',
          payload: html,
          url: 'https://nexora.dev',
          trusted_sources: ['nexora.dev'],
        },
        __typename: 'GenAISingleLayoutViewModel',
      },
    }],
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const fallbackText = isResult
    ? `🎉 I found it: ${safeName}\n\n${safeDesc}\n\nType .akinator start to play again.`
    : `🧞 Question ${step + 1}: ${safeQ}\n\nAnswer with .akinator yes / no / don't know / maybe / probably not`;

  try {
    await sock.relayMessage(chat, {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        messageSecret: crypto.randomBytes(32),
        botMetadata: {
          messageDisclaimerText: 'Copyright © NEXORA MD - Akinator',
          botResponseId: responseId,
          ...(certificateChain.length
            ? {
                verificationMetadata: {
                  proofs: [{
                    version: 1,
                    useCase: 1,
                    signature: VERIFICATION_SIGNATURE,
                    certificateChain,
                  }],
                },
              }
            : {}),
        },
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText: isResult ? `🎉 Found: ${safeName}` : `🧞 Question ${step + 1}` }],
            unifiedResponse: { data: b64 },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
              forwardOrigin: 4,
            },
          },
        },
      },
    }, {});
  } catch (err) {
    console.warn('[akinator] HTML relay failed, plain fallback:', err.message);
    await m.reply(fallbackText);
  }
}

export default {
  name: 'akinator',
  aliases: ['tebakkarakter', 'tebak', 'karakter', 'mardbiru', 'mard', 'mared', 'guesscharacter'],
  category: 'games',
  description: 'Akinator — think of a famous character and I will guess it. Usage: .akinator start, then answer yes / no / don\'t know / maybe / probably not.',
  cooldown: 2000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const key = `${m.from}-${m.sender}`;
    const input = args.join(' ').toLowerCase().trim();

    if (['yes', 'no', "don't know", 'maybe', 'probably not', 'back', 'delete', 'start'].includes(input)) {
      const s = sessions[key];
      try {
        if (input === 'start') {
          const data = await postJson(`${API}/akinator_start`);
          sessions[key] = { session: data.session, signature: data.signature, step: data.step, progression: data.progression };
          return await sendHtml(sock, m.from, m, data.question, data.akitude_url, data.step, data.progression, false);
        }
        if (!s) return await m.reply(`⚠️ No session. Type *${p}akinator start*`);
        if (input === 'delete') {
          delete sessions[key];
          return await m.reply(`✅ Session deleted. Type *${p}akinator start* to play again`);
        }
        if (input === 'back') {
          const data = await postJson(`${API}/akinator_back`, {
            session: s.session, signature: s.signature, step: s.step, progression: s.progression, cm: 'false',
          });
          sessions[key].step = data.step;
          sessions[key].progression = data.progression;
          return await sendHtml(sock, m.from, m, data.question, data.akitude_url, data.step, data.progression, false);
        }
        const ansMap = { yes: 0, no: 1, "don't know": 2, maybe: 3, 'probably not': 4 };
        const data = await postJson(`${API}/akinator_answer`, {
          session: s.session,
          signature: s.signature,
          step: s.step,
          progression: s.progression,
          answer: ansMap[input],
          cm: 'false',
          sid: 'NaN',
          question_filter: 'string',
        });
        if (data.name_proposition) {
          delete sessions[key];
          return await sendHtml(sock, m.from, m, null, data.photo, 0, 100, true, data.name_proposition, data.description_proposition);
        }
        sessions[key].step = data.step;
        sessions[key].progression = data.progression;
        return await sendHtml(sock, m.from, m, data.question, data.akitude_url, data.step, data.progression, false);
      } catch (e) {
        return await m.reply(`❌ Error: ${e.message}`);
      }
    }
    return await sendHtml(sock, m.from, m, 'Think of a famous character in your mind... I will guess it!', null, 0, 0, false, null, null, true);
  },
};
