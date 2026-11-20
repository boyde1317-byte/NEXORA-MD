/**
 * airichMenu.js — menu style 23 ("airichMenu") — the AIRich developer card.
 *
 * Ported from LUNA MD plugins/menu3.js (the "menu3 / menugp" card) as a
 * NexoraFlex menu TYPE: renderer({ sock, m, menuData }) instead of a
 * plugin handler. Pick it with `.setmenu 23` / `.menu airichMenu`.
 *
 * What it shows: the requester's picture on top, the developer entity
 * card underneath, product cards for You / NEXORA MD / Developer, a
 * command table, and three widget sheets (Download / Tools / All Menu).
 *
 * Differences from the LUNA original:
 *   - The pasted-in local AIRich class is gone — this uses the shared
 *     lib (src/lib/NIXCODE.js), which already ships addImage/addEntity/
 *     addProduct/addText/addTable/addMultiWidgets/addFooterLinks with
 *     the same signatures the original relied on.
 *   - Hardcoded old-owner dev number -> menuData.ownerNumber
 *     (config owner). Hardcoded group link + REM channel URL are gone:
 *     footer links point at the NexoraFlex channel invite from
 *     getChannelContext() (set via `.setchannel`) and wa.me/<owner>.
 *   - Command "prices" (`.tiktok 1800x`, `.ai 3500x`, bot `15k`,
 *     developer `50k`) are gone — NexoraFlex commands are free; the
 *     table now lists what each command does, and the product cards
 *     read FREE / Contact instead of a price in k.
 *   - Widget button ids are real invocations: download/tools rows run
 *     the command (`.tiktok`, `.sticker`...), All-Menu rows open the
 *     house drill-down (`.help <category>`), matching zapoMenu.
 *   - `m.pushName` -> getDisplayName(sock, m.sender); user/bot/dev
 *     profile pictures fall back to the brand assets, not the old
 *     owner's catbox link.
 *   - Title/footer branding: NEXORA MD, `brand.signature` ("By Moonson").
 */
import { AIRich } from '../../lib/NIXCODE.js';
import brand from '../../../config/brand.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { getChannelContext } from '../../lib/channelPromo.js';
import { getDisplayName } from '../../lib/displayName.js';

export const airichMenu = {
  id: 23,
  name: 'airichMenu',
  description: 'AIRich developer card — requester photo, developer entity, product cards, command table, widget sheets',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const p = menuData.prefix || '.';
    const botName = menuData.botName || brand.name || 'NEXORA MD';
    const devNumber = String(menuData.ownerNumber || '').replace(/\D/g, '') || '233533416608';
    const channel = getChannelContext();
    const channelUrl = channel.invite || '';
    const userName = await getDisplayName(sock, m.sender);

    let devPp = ASSET_URLS.thumbnail;
    let userPp = ASSET_URLS.menuBanner;
    let botPp = ASSET_URLS.thumbnail;
    try { devPp = await sock.profilePictureUrl(`${devNumber}@s.whatsapp.net`, 'image'); } catch (_) {}
    try { userPp = await sock.profilePictureUrl(m.sender, 'image'); } catch (_) {}
    try { botPp = await sock.profilePictureUrl(sock.user?.id || sock.user?.jid || '', 'image'); } catch (_) {}

    const card = new AIRich(sock)
      .setTitle(`${botName} • GP`)
      .setFooter(`© ${brand.signature || 'By Moonson'}`)
      .addImage(userPp)
      // Only the developer below the image
      .addEntity({
        title: `👑 Developer ${botName}`,
        subtitle: `Owner • Full Stack • ${userName}`,
        secondary: `Bot services • WA: +${devNumber}`,
        id: devNumber,
        imageUrl: devPp,
      })
      .addProduct([
        { title: '👤 You', brand: 'USER', price: 'FREE', url: `https://wa.me/${m.sender.split('@')[0]}`, image: userPp },
        { title: `🤖 ${botName}`, brand: brand.creator || 'NEXORA', price: 'FREE', sale_price: 'FREE', url: channelUrl, image: botPp },
        { title: '👑 Developer', brand: brand.creator || 'Moonson', price: 'Contact', url: `https://wa.me/${devNumber}`, image: devPp },
      ])
      .addText('# ⚡ FULL MENU')
      .addTable([
        ['Command', 'Use'],
        [`${p}tiktok`, 'TikTok download'],
        [`${p}play`, 'YouTube audio'],
        [`${p}ig`, 'Instagram download'],
        [`${p}ai`, 'AI chat'],
        [`${p}sticker`, 'Make a sticker'],
      ])
      .addMultiWidgets([
        {
          title: 'DOWNLOAD MENU',
          buttons: [
            { label: 'Tiktok', id: `${p}tiktok` },
            { label: 'Youtube', id: `${p}play` },
            { label: 'Instagram', id: `${p}ig` },
            { label: 'Facebook', id: `${p}fb` },
            { label: 'Mediafire', id: `${p}mediafire` },
          ],
        },
        {
          title: 'TOOLS MENU',
          buttons: [
            { label: 'Sticker', id: `${p}sticker` },
            { label: 'ToImg', id: `${p}toimg` },
            { label: 'HD', id: `${p}hd` },
            { label: 'Remini', id: `${p}remini` },
            { label: 'Translate', id: `${p}translate` },
            { label: 'AI Chat', id: `${p}ai` },
          ],
        },
        {
          title: 'ALL MENU',
          buttons: [
            { label: 'Group', id: `${p}help group` },
            { label: 'Owner', id: `${p}help owner` },
            { label: 'Fun', id: `${p}help fun` },
            { label: 'Game', id: `${p}help games` },
          ],
        },
      ])
      .addFooterLinks([
        ...(channelUrl ? [{ text: 'Join Channel', url: channelUrl }] : []),
        { text: 'Contact Developer', url: `https://wa.me/${devNumber}` },
      ]);

    await card.send(m.from, { quoted: m });
  },
};

export default airichMenu;
