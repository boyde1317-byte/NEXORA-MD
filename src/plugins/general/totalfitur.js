/**
 * totalfitur.js — .totalfitur — total features / total commands card.
 *
 * Ported from LUNA MD plugins/totalfitur.js. The original counted
 * Object.values(global.plugins); NexoraFlex has no such global — its
 * registry is client.commands (name -> plugin), passed in the execute
 * context. Total features = loaded commands; total commands = commands
 * + aliases.
 *
 * Differences from the original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - The A2UI header image was the old owner's catbox link; it is now
 *     the NEXORA brand banner (ASSET_URLS.menuBanner). The "Chat Owner"
 *     button URL was a placeholder Indonesian number; it is now
 *     wa.me/233533416608 (moonson).
 *   - The senderKeyDistributionMessage groupId fallback was a hardcoded
 *     LUNA group id; it is now the current chat (m.from).
 *   - Branding LUNA MD -> NEXORA MD.
 *   - On relay failure the original logged and fell back to plain text;
 *     kept.
 *
 * Note: the house general/stats.js already shows loaded command/alias
 * counts as plain text — this is the A2UI card variant of the same job.
 */
import crypto from 'node:crypto';
import { ASSET_URLS } from '../../assets/assetUrls.js';

const OWNER_NUMBER = '233533416608';

export default {
  name: 'totalfitur',
  aliases: [],
  category: 'general',
  description: 'Show the total number of features and commands as a card.',
  cooldown: 3000,
  execute: async ({ m, sock, client }) => {
    const commands = client?.commands;
    const totalFitur = commands?.size ?? 0;
    const totalCmd = commands
      ? [...commands.values()].reduce((n, p) => n + 1 + (p.aliases?.length || 0), 0)
      : 0;

    const data = {
      version: 'v0.9',
      createSurface: {
        surfaceId: `nexora-${Date.now()}`,
        catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
        components: [
          { id: 'root', component: 'Column', children: ['image_0', 'title_0', 'text_0', 'button_0'] },
          { id: 'image_0', component: 'Image', url: ASSET_URLS.menuBanner, variant: 'header', fit: 'cover' },
          { id: 'title_0', component: 'Text', text: 'NEXORA MD', variant: 'h1' },
          { id: 'text_0', component: 'Text', text: `Total Features: ${totalFitur}\nTotal Commands: ${totalCmd}\n\nType menu to see the full feature list.`, variant: 'body' },
          { id: 'button_0', component: 'Button', child: 'button_text_0', variant: 'primary', action: { call: 'openUrl', args: { url: `https://wa.me/${OWNER_NUMBER}` } } },
          { id: 'button_text_0', component: 'Text', text: 'Chat Owner', variant: 'body' },
        ],
      },
    };

    try {
      await sock.relayMessage(
        m.from,
        {
          senderKeyDistributionMessage: {
            groupId: m.from,
            axolotlSenderKeyDistributionMessage: crypto.randomBytes(32).toString('base64'),
          },
          messageContextInfo: {
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
            nativeFlowMessage: {
              messageParamsJson: '{}',
            },
            bloksWidget: {
              uuid: crypto.randomUUID(),
              data: JSON.stringify(data),
              type: 'im_a2ui',
            },
          },
        },
        {
          additionalNodes: [
            {
              tag: 'biz',
              attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: '1710069489' },
              content: [
                { tag: 'engagement', attrs: { customer_service_state: 'open', conversation_state: 'open' } },
                { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] },
              ],
            },
          ],
        }
      );
    } catch (e) {
      console.log(e);
      await sock.sendMessage(m.from, { text: `Total Features: ${totalFitur}\nTotal Commands: ${totalCmd}` }, { quoted: m });
    }
  },
};
