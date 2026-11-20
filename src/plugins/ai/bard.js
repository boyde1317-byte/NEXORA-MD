/**
 * bard.js — .bard — Gemini web chat (cookie-based).
 *
 * Ported from the LUNA MD commands/ai/gemini.js (command name `gemini`,
 * aliases ai/ask/bard). NexoraFlex already ships an API-key Gemini path,
 * so this one keeps the LUNA name `bard` to avoid shadowing.
 *
 * HOW IT WORKS — COOKIE FILE (read this before using):
 * This talks to gemini.google.com as if it were a logged-in browser
 * session. It needs the operator's Google cookies, stored in a file
 * named `Geminicook.txt` in the bot's working directory (project root).
 * The file may hold either a raw `Cookie:` header value
 * (`name=value; name2=value2`) or a Netscape-format cookies export
 * (tab-separated lines, `#HttpOnly_` prefixes understood). No cookie
 * file (or an expired one) -> the command replies with an error telling
 * the operator to create/refresh it. The cookies are read from disk on
 * every call, so refreshing the file needs no restart.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `ctx` -> execute context
 *     (`m.from` is the chat, `rawMessage` is the raw Baileys message).
 *   - Request language changed from Indonesian to English
 *     (`hl: 'en'` and the inner request language field).
 *   - Per-chat conversation state moved from `global.geminiChatSessions`
 *     to a module-level Map (same lifetime, no global pollution).
 *   - Image download uses `downloadMediaMessage` from 'baileys' on the
 *     raw message (quoted image, or the command message itself), the
 *     same helper the house .vision plugin uses.
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { downloadMediaMessage } from 'baileys';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Per-chat conversation state: chat jid -> { conversationId, responseId, candidateId, turnIndex }
const geminiChatSessions = new Map();

function parseCookies(input) {
  if (!input) return '';
  if (!input.includes('\t') && !input.includes('\n') && input.includes('=')) return input.trim();
  const cookies = [];
  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim();
    if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) continue;
    const cleanLine = line.startsWith('#HttpOnly_') ? line.slice(10) : line;
    const parts = cleanLine.split(/\s+/);
    if (parts.length >= 7) cookies.push(`${parts[5]}=${parts.slice(6).join(' ')}`);
  }
  return cookies.join('; ');
}

async function loadCookiesFromFile() {
  try {
    const cookiePath = path.resolve('./Geminicook.txt');
    if (fs.existsSync(cookiePath)) return parseCookies(fs.readFileSync(cookiePath, 'utf8'));
    return '';
  } catch (_) {
    return '';
  }
}

function fetchAppHtml(cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request('https://gemini.google.com/app', {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
      maxHeaderSize: 65536,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

async function getSessionTokens() {
  const cookieHeader = await loadCookiesFromFile();
  if (!cookieHeader) throw new Error('Cookie not found. Create a Geminicook.txt file in the main bot folder (see the header comment in src/plugins/ai/bard.js).');

  const html = await fetchAppHtml(cookieHeader);
  const matchWiz = html.match(/window\.WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
  if (!matchWiz) throw new Error('Failed to fetch system data. The cookie may have expired.');

  const wiz = JSON.parse(matchWiz[1]);
  if (!wiz.SNlM0e) throw new Error('Failed to get the access token from Google.');

  return { at: wiz.SNlM0e, bl: wiz.cfb2h, fsid: wiz.FdrFJe, cookies: cookieHeader };
}

async function uploadMedia(buffer, mimeType = 'image/jpeg', filename = 'image.jpg') {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  form.append('file', blob, filename);

  const res = await fetch('https://content-push.googleapis.com/upload', {
    method: 'POST',
    headers: {
      'X-Tenant-Id': 'bard-storage',
      'Push-ID': 'feeds/mcudyrk2a4khkz',
      Origin: 'https://gemini.google.com',
      Referer: 'https://gemini.google.com/',
    },
    body: form,
  });

  if (!res.ok) throw new Error(`Failed to upload media to Google (${res.status})`);
  return (await res.text()).trim();
}

function parseFrames(text) {
  const results = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('[["wrb.fr"')) {
      try {
        const parsed = JSON.parse(line);
        for (const item of parsed) {
          if (item[0] === 'wrb.fr' && item[2]) results.push({ rpcid: item[1], data: JSON.parse(item[2]) });
        }
      } catch (_) {}
    }
  }
  return results;
}

async function askGemini(prompt, options = {}, fileData = null) {
  const session = await getSessionTokens();
  const reqId = String(Math.floor(Math.random() * 900000) + 100000);
  const uuidVal = crypto.randomUUID().toUpperCase();
  const lang = 'en';

  const innerReq = new Array(69).fill(null);
  innerReq[0] = [prompt, 0, null, fileData, null, null, 0];
  innerReq[1] = [lang];
  innerReq[2] = options.conversationId ? [options.conversationId, options.responseId || '', options.candidateId || ''] : ['', '', ''];
  innerReq[4] = crypto.randomBytes(16).toString('hex');
  innerReq[6] = [1];
  innerReq[7] = 1;
  innerReq[10] = 1;
  innerReq[11] = 0;
  innerReq[17] = [[options.turnIndex || 0]];
  innerReq[18] = 0;
  innerReq[27] = 1;
  innerReq[30] = [4];
  innerReq[41] = [1];
  innerReq[53] = 0;
  innerReq[55] = [[1]];
  innerReq[59] = uuidVal;
  innerReq[61] = [];
  innerReq[68] = 2;

  const fReq = JSON.stringify([null, JSON.stringify(innerReq)]);
  const params = new URLSearchParams({ bl: session.bl, 'f.sid': session.fsid, hl: lang, _reqid: reqId, rt: 'c' });

  const res = await fetch(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${params.toString()}`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: session.cookies,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: 'https://gemini.google.com',
      Referer: 'https://gemini.google.com/app',
      'x-goog-ext-525005358-jspb': `["${uuidVal}",1]`,
    },
    body: new URLSearchParams({ at: session.at, 'f.req': fReq }),
  });

  if (!res.ok) throw new Error(`Request failed (${res.status})`);

  const text = await res.text();
  const frames = parseFrames(text);

  let finalReply = '';
  let conversationId = null;
  let responseId = null;
  let candidateId = null;

  for (const f of frames) {
    if (Array.isArray(f.data)) {
      if (f.data[1] && Array.isArray(f.data[1])) {
        conversationId = f.data[1][0] || conversationId;
        responseId = f.data[1][1] || responseId;
      }
      if (f.data[4] && Array.isArray(f.data[4]) && f.data[4][0]) {
        candidateId = f.data[4][0][0] || candidateId;
        const candidateText = f.data[4][0][1]?.[0];
        if (candidateText) {
          // Strip Chameleon UI blocks, citations and reference tags.
          finalReply = candidateText
            .replace(/\n*```json\?chameleon[\s\S]*?```\n*/g, '')
            .replace(/\[cite:[^\]]+\]/g, '')
            .replace(/\[\d+\]/g, '')
            .trim();
        }
      }
    }
  }

  return { text: finalReply, conversationId, responseId, candidateId };
}

export default {
  name: 'bard',
  aliases: [], // NOTE: no 'gemini' alias — ai/gemini.js owns .gemini (collision fix, 2026-11-20)
  category: 'ai',
  description: 'Chat with Google Gemini via the web session (needs a Geminicook.txt cookie file). Reply to an image to ask about it. Use ".bard reset" to clear the chat memory.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, rawMessage }) => {
    const p = prefix || '.';
    let query = args.join(' ').trim();
    const chatId = m.from;

    if (query.toLowerCase() === 'reset') {
      geminiChatSessions.delete(chatId);
      return await m.reply('✅ Gemini chat memory for this chat has been deleted!');
    }

    const isQuotedImage = m.quoted?.mimetype?.includes('image');
    const isImageMsg = m.msg?.mimetype?.includes('image');
    const hasImage = isQuotedImage || isImageMsg;

    if (!query && !hasImage) {
      return await m.reply(
        '⚠️ *Wrong Format!*\n\n' +
        'Type a question or send/reply to an image.\n' +
        `Example: *${p}bard explain this image*`,
      );
    }

    if (!query && hasImage) query = 'Please explain this image in detail.';

    let fileData = null;
    if (hasImage) {
      await m.reply('⏳ _Reading and uploading the image to the Google server..._');
      try {
        // Same shape the house .vision plugin uses: the raw message for a
        // direct image, the quoted message inside it for a reply.
        const raw = rawMessage?.message || {};
        const targetMessage = isQuotedImage
          ? raw.extendedTextMessage?.contextInfo?.quotedMessage
          : raw;
        if (!targetMessage) throw new Error('Image message not found.');
        // Same key shape the house .vision plugin uses: the quoted
        // message's stanza id when replying, the command's own key else.
        const mediaKey = isQuotedImage ? m.msg?.contextInfo?.stanzaId : m.key;
        const mediaBuffer = await downloadMediaMessage(
          { key: mediaKey, message: targetMessage },
          'buffer',
          {},
          { logger: console, reuploadRequest: sock.updateMediaMessage },
        );
        if (!mediaBuffer?.length) throw new Error('Image is empty/unreadable.');

        const mimeType = (isQuotedImage ? m.quoted?.mimetype : m.msg?.mimetype) || 'image/jpeg';
        const uploadId = await uploadMedia(mediaBuffer, mimeType, 'image.jpg');
        fileData = [[[uploadId], 'image.jpg']];
      } catch (err) {
        return await m.reply(`⚠️ Failed to process the image: ${err.message}`);
      }
    }

    await m.reply('⏳ _Gemini is thinking..._');

    try {
      const sessionData = geminiChatSessions.get(chatId) || { turnIndex: 0 };
      const result = await askGemini(query, sessionData, fileData);

      if (!result.text) throw new Error('Empty response from the Google server.');

      geminiChatSessions.set(chatId, {
        conversationId: result.conversationId,
        responseId: result.responseId,
        candidateId: result.candidateId,
        turnIndex: sessionData.turnIndex + 1,
      });

      await m.reply(result.text);
    } catch (err) {
      console.error('[bard Error]:', err.message);
      await m.reply(`⚠️ An error occurred: ${err.message}`);
    }
  },
};
