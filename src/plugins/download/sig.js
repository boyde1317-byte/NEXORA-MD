/**
 * sig.js — .sig / .iglookup / .lookupig — Instagram profile lookup card.
 *
 * Ported from LUNA MD plugins/sig.js.
 *
 * Differences from the original:
 *   - Rebrand: "© Luna - Dev moonson" / "Luna MD" -> "© NEXORA MD" /
 *     "NEXORA MD".
 *   - The card relay is sent with a `messageContextInfo` (fresh secret +
 *     botResponseId, house pattern) and a plain-text fallback if the
 *     relay fails (the original threw the raw error at the user).
 *   - `conn.relayMessage(m.chat, ...)` -> `sock.relayMessage(m.from, ...)`.
 *   - The Instagram web app ID header is a public constant, not a secret
 *     — kept as-is. The default picture is still the generic catbox link
 *     the original used; it only shows when the real profile picture
 *     cannot be fetched.
 *   - No other changes: same endpoint, same card shape, English already.
 */
import crypto from 'crypto';

const DEFAULT_PIC = 'https://files.catbox.moe/qnof82.jpg';

export default {
  name: 'sig',
  aliases: ['iglookup', 'lookupig'],
  category: 'download',
  description: 'Look up an Instagram profile. Usage: .sig <username>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'sig';
    const username = (args || [])[0];
    if (!username) {
      return m.reply(`📌 *How to use:*\n\n${prefix}${cmd} <username>\n\nExample:\n${prefix}${cmd} go24.q`);
    }

    const cleanUser = username
      .replace(/^@/, '')
      .replace(/https?:\/\/(www\.)?instagram\.com\//, '')
      .replace(/\/.*$/, '');

    let profilePic = DEFAULT_PIC;
    let fullName = 'NEXORA MD';
    let bio = '© NEXORA MD';
    let followers = '-';

    try {
      const res = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`,
        {
          headers: {
            'X-IG-App-ID': '936619743392459',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      const json = await res.json().catch(() => null);
      const user = json?.data?.user;
      if (user) {
        profilePic = user.hd_profile_pic_url_info?.url || user.profile_pic_url_hd || profilePic;
        fullName = user.full_name || cleanUser;
        bio = user.biography || bio;
        followers = user.edge_followed_by?.count || user.follower_count || '-';
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
                  subtitle: `@${cleanUser} • ${bio.substring(0, 40)}`,
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
                    text: '# {{social_entity_1}}View Profile\0{{/social_entity_1}} ',
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
      console.warn('[sig] profile card relay failed, plain fallback:', e?.message);
      await m.reply(`📷 *${fullName}* (@${cleanUser})\n${bio}\n${followers} followers\nhttps://instagram.com/${cleanUser}`);
    }
  },
};
