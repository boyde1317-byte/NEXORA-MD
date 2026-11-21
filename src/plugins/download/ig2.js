/**
 * ig2.js — .ig2 / .igphoto — Instagram downloader (V4) + profile card.
 *
 * Ported from LUNA MD plugins/ig.js.
 *
 * Name: `ig2` (not `ig`) because NexoraFlex already owns `.ig` /
 * `.instagram` / `.igdl` (src/plugins/download/ig.js). Alias `igphoto`
 * is free. The original's other commands (`ig`, `igdl`, `instagram`)
 * are NOT claimed here.
 *
 * API KEY — READ THIS: the original shipped a hardcoded itsvall API key
 * in the Method 1 URL. That key is NOT shipped here. It is replaced by
 * the ITSVALL_API_KEY placeholder below — put your own key there or
 * Method 1 will fail and the command falls through to the keyless
 * Methods 2 and 3. Never commit a real key in this file.
 *
 * Differences from the original:
 *   - No axios / node-fetch (NexoraFlex has neither): global `fetch`
 *     everywhere, including the media downloads.
 *   - No tmp files and no `conn.sendFile`: media is fetched to a Buffer
 *     in memory and sent with `sock.sendMessage({ image/video: buf })`
 *     (house download pattern). The 50 KB corrupt-video guard is kept.
 *   - The profile card relay is kept (same compact-entity card), rebranded
 *     NEXORA MD, sent with a `messageContextInfo` (fresh secret +
 *     botResponseId, house pattern) and a plain-text fallback if the
 *     relay fails. The Instagram web app ID header is a public constant,
 *     not a secret — kept as-is.
 *   - `handler.limit = true` is dropped (NexoraFlex has no limit system).
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 */
import crypto from 'crypto';

// PUT YOUR OWN itsvall API KEY HERE — the original's hardcoded key was
// removed and must never be committed. Methods 2 and 3 below are keyless.
const ITSVALL_API_KEY = 'PUT_YOUR_OWN_KEY_HERE';

const DEFAULT_PIC = 'https://files.catbox.moe/qnof82.jpg';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeout || 15000) });
  return res.json().catch(() => null);
}

export default {
  name: 'ig2',
  aliases: ['igphoto'],
  category: 'download',
  description: 'Download Instagram media from a link. Usage: .ig2 https://www.instagram.com/p/xxx/ (needs your own itsvall key for method 1; methods 2-3 are keyless)',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'ig2';
    const input = (args || []).join(' ').trim();
    if (!input) {
      return m.reply(`❌ Enter an Instagram URL!\nExample: *${prefix}${cmd} https://www.instagram.com/p/CXYZ123/*`);
    }
    if (!input.includes('instagram.com')) return m.reply('❌ Invalid link.');

    await m.reply('🔍 _Analyzing Instagram link..._');

    const targetUrl = input.trim();
    let mediaItems = [];
    let methodUsed = '';
    let usernameFound = null;

    // --- METHOD 1: VALL API (needs ITSVALL_API_KEY above) ---
    if (ITSVALL_API_KEY && ITSVALL_API_KEY !== 'PUT_YOUR_OWN_KEY_HERE') {
      try {
        const data = await fetchJson(
          `https://api.itsvall.dev/api/instadownv2?url=${encodeURIComponent(targetUrl)}&apikey=${encodeURIComponent(ITSVALL_API_KEY)}`
        );
        if (data?.status === 200 && data?.result) {
          const items = data.result;
          usernameFound = data.username || data.result[0]?.username || null;
          for (const item of items) {
            const u = item.media_url || item.url;
            if (u) mediaItems.push({ url: u, isVideo: item.is_video === true || u.includes('.mp4') });
          }
          if (mediaItems.length > 0) methodUsed = 'Vall API';
        }
      } catch (_) {}
    }

    // --- METHOD 2: INSTALOADR (keyless) ---
    if (mediaItems.length === 0) {
      try {
        const postData = await fetchJson('https://www.instaloadr.com/api/fetch', {
          method: 'POST',
          timeout: 25000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://www.instaloadr.com/',
            Origin: 'https://www.instaloadr.com',
          },
          body: JSON.stringify({ url: targetUrl, media_type: 'post' }),
        });
        if (postData && Array.isArray(postData.items)) {
          usernameFound = postData.username || postData.owner || postData.items[0]?.username || null;
          for (const it of postData.items) {
            if (it.download_url) {
              mediaItems.push({ url: it.download_url, isVideo: it.media_type === 'video' || it.download_url.includes('.mp4') });
            }
          }
          if (mediaItems.length > 0) methodUsed = 'Instaloadr';
        }
      } catch (_) {}
    }

    // --- METHOD 3: SIPUTZX FALLBACK (keyless) ---
    if (mediaItems.length === 0) {
      try {
        const data = await fetchJson(
          `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(targetUrl)}`
        );
        if (data?.status && data?.data) {
          usernameFound = data.username || data.data[0]?.username || null;
          mediaItems = data.data.map((x) => ({ url: x.url, isVideo: x.url.includes('.mp4') }));
          if (mediaItems.length > 0) methodUsed = 'Siputzx';
        }
      } catch (_) {}
    }

    // --- METHOD 4: username from the URL itself ---
    if (!usernameFound) {
      const match = targetUrl.match(/instagram\.com\/([a-zA-Z0-9._]+)(?:\/p\/|\/reel\/|\/)/);
      if (match && !['p', 'reel', 'stories'].includes(match[1])) usernameFound = match[1];
    }

    if (mediaItems.length === 0) {
      return m.reply('❌ _Failed to extract media. Make sure the link is public._');
    }

    await m.reply(`⏳ _Found ${mediaItems.length} media (via ${methodUsed}). Sending..._`);

    for (let i = 0; i < mediaItems.length; i++) {
      try {
        const item = mediaItems[i];
        const mediaRes = await fetch(item.url, {
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.instagram.com/' },
          signal: AbortSignal.timeout(60000),
        });
        if (!mediaRes.ok) throw new Error(`media fetch ${mediaRes.status}`);
        const buffer = Buffer.from(await mediaRes.arrayBuffer());
        const contentType = mediaRes.headers.get('content-type') || '';
        const isVideo = item.isVideo || contentType.includes('video');
        if (contentType.includes('text/html') || (isVideo && buffer.length < 50000)) throw new Error('corrupt');
        const caption = i === 0
          ? `📷 *INSTAGRAM DOWNLOADER*\nMedia ${i + 1} of ${mediaItems.length}`
          : `✅ Media ${i + 1} of ${mediaItems.length}`;
        if (isVideo) {
          await sock.sendMessage(m.from, { video: buffer, mimetype: 'video/mp4', caption }, { quoted: m });
        } else {
          await sock.sendMessage(m.from, { image: buffer, caption }, { quoted: m });
        }
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        console.error('[ig2] media failed:', e?.message);
        await m.reply(`⚠️ Failed media #${i + 1}`);
      }
    }

    // --- IF A USERNAME IS FOUND, SEND THE PROFILE CARD ---
    if (usernameFound) {
      try {
        const cleanUser = usernameFound.replace(/^@/, '').replace(/\/.*$/, '');
        let profilePic = DEFAULT_PIC;
        let fullName = cleanUser;
        let bio = '© NEXORA MD';
        let followers = '-';

        try {
          const json = await fetchJson(
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`,
            { headers: { 'X-IG-App-ID': '936619743392459', 'User-Agent': 'Mozilla/5.0' } }
          );
          const user = json?.data?.user;
          if (user) {
            profilePic = user.hd_profile_pic_url_info?.url || user.profile_pic_url_hd || profilePic;
            fullName = user.full_name || cleanUser;
            bio = user.biography?.substring(0, 40) || bio;
            followers = user.follower_count || user.edge_followed_by?.count || '-';
          }
        } catch (_) {}

        const FOOTER = `© NEXORA MD | ${followers} Followers`;
        const richMsg = {
          messageType: 1,
          submessages: [],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify({
              sections: [
                {
                  view_model: {
                    primitives: [{
                      title: fullName,
                      subtitle: `@${cleanUser} • ${bio}`,
                      secondary_subtitle: FOOTER,
                      image: { url: profilePic, mime_type: 'image/jpeg' },
                      entity_id: '123456',
                      entity_url: 'https://instagram.com/' + cleanUser,
                      entity_type: 'WEBSITE',
                      action_type: 'OPEN_URL',
                      is_verified: true,
                      __typename: 'GenAICompactEntityPrimitive',
                    }],
                    __typename: 'GenAIActionRowLayoutViewModel',
                  },
                },
                {
                  view_model: {
                    primitives: [{ type: 'HORIZONTAL_LINE', __typename: 'GenAIDividerPrimitive' }],
                    __typename: 'GenAIVStackLayoutViewModel',
                  },
                },
                {
                  view_model: {
                    primitives: [
                      { __typename: 'GenAISpacerPrimitive' },
                      {
                        text: '# {{social_entity_1}}View Owner Profile\0{{/social_entity_1}} ',
                        inline_entities: [{
                          key: 'social_entity_1',
                          metadata: {
                            __typename: 'GenAISocialEntityItem',
                            entity_id: cleanUser,
                            entity_name: cleanUser,
                            entity_full_name: fullName,
                            entity_picture_url: profilePic,
                            entity_url: 'https://www.instagram.com/' + cleanUser,
                            entity_type: 'IG_PROFILE',
                            is_verified: true,
                          },
                        }],
                        __typename: 'GenAIMarkdownTextUXPrimitive',
                      },
                      { __typename: 'GenAISpacerPrimitive' },
                    ],
                    __typename: 'GenAIActionRowLayoutViewModel',
                  },
                },
              ],
            })).toString('base64'),
          },
          contextInfo: { isForwarded: true, forwardOrigin: 4 },
        };

        try {
          await sock.relayMessage(m.from, {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
              messageSecret: crypto.randomBytes(32),
              botMetadata: { messageDisclaimerText: '', botResponseId: crypto.randomUUID() },
            },
            botForwardedMessage: { message: { richResponseMessage: richMsg } },
          }, {});
        } catch (e) {
          console.warn('[ig2] profile card relay failed:', e?.message);
          await m.reply(`📷 *${fullName}* (@${cleanUser})\n${bio}\n${followers} followers\nhttps://instagram.com/${cleanUser}`);
        }
      } catch (e) {
        console.log('[ig2] failed to send profile card:', e.message);
      }
    }
  },
};
