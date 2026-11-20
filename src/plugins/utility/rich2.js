/**
 * rich2.js — MessageBuilderV4.7 live tour (hardcoded AIRich demo).
 *
 *   .rich2   the full AIRich feature tour in one card: text, image,
 *            video, code, table, mixed product/post/reels, sources
 *
 * Ported from the LUNA MD rich.js plugin as-is, rebranded. NexoraFlex
 * already ships .rich (src/plugins/utility/rich.js, alias richresponse),
 * so this variant is .rich2 and never shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/rich.js):
 *   - `../lib/nnn.js` AIRich -> the shared house builder from
 *     src/lib/NIXCODE.js (v4.5).
 *   - The house AIRich has NO live-edit path: no `sendEdit()`, and no
 *     `insertAt` / `replace` / `id` options on addText/addImage/addVideo/
 *     addCode/addTable. The LUNA tour built one message up over ~15
 *     edits with loading placeholders; here the same sections are built
 *     in the same order into ONE card and sent once. The loading-state
 *     addImage('') / addVideo('') placeholders are gone — the real
 *     image/video URLs go in directly.
 *   - No `addWidget` / `addFooterAction` / `addMetadata` in the house
 *     lib: the widget becomes an addTip, the footer action becomes
 *     addFooterLinks, the metadata line becomes an addTip.
 *   - `addSource` takes arrays here ([icon, url, title]), not objects.
 *   - `addPost` / `addReels` read `profile_url` (not `profile:`), so
 *     the demo entries use that key.
 *   - The `.items` extraction (build content in a second AIRich, then
 *     mix it in with newLayout) is kept via a tiny subclass exposing
 *     the house builder's `_sections` — the house class has no `.items`
 *     getter of its own.
 *   - The hardcoded WhatsApp channel link (footer action + widget) is
 *     gone; the footer link points at the NexoraFlex repo instead.
 *   - The `delay` import from 'baileys' is gone with the edit steps.
 *   - Demo copy stays as-is (MessageBuilderV4.7 / Nixel / Fiora are the
 *     builder's own demo data); only the bot footer is rebranded to
 *     NEXORA MD.
 */
import { AIRich } from '../../lib/NIXCODE.js';

/** House AIRich plus the `.items` accessor the LUNA demo relied on. */
class AIRichX extends AIRich {
  get items() {
    return this._sections;
  }
}

const FIORA_IMG = 'https://cdn.ornzora.eu.cc/2a639cd2-5c33-49e3-982f-77f471c9313f-FIORA.jpg';
const FIORA_PROFILE = 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg';
const FIORA_VIDEO = 'https://cdn.ornzora.eu.cc/3bb12237-2365-4a76-a4e2-635faea6d54c-FIORA.mp4';
const REPO_URL = 'https://github.com/boyde1317-byte/NexoraFlex';

export default {
  name: 'rich2',
  aliases: [],
  category: 'utility',
  description: 'MessageBuilderV4.7 tour — text, image, video, code, table and mixed cards in one AIRich message.',
  cooldown: 5000,
  execute: async ({ sock, m }) => {
    const rich = new AIRichX(sock)
      .setTitle('MessageBuilderV4.7')
      .addText(
        'Hey! Welcome to [MessageBuilderV4.7](https://gist.github.com/ValdazGT) 👋'
      )
      .setFooter('NEXORA MD • Built with MessageBuilderV4.7');

    rich.addText(
      'This is a live tour of MessageBuilderV4.7. Everything below is built directly into this message.'
    );

    rich.addSuggest([
      'MessageBuilderV4.7',
      'Dynamic AIRich',
      'NIXCODE',
    ]);

    rich.addText(
      'First, loading states. The item appears first, then gets replaced when the content is ready.'
    );

    rich.addImage(FIORA_IMG);

    rich.addText('Video supports the same loading → replace flow.');

    rich.addVideo(FIORA_VIDEO);

    rich.addText('Now for code blocks with syntax highlighting.');

    rich.addCode(
      'javascript',
      `function greet(name) {
\treturn \`Hello, \${name}!\`
}

greet('Nixel')`
    );

    rich.addText('Tables are supported too.');

    rich.addTable(
      [
        ['Name', 'Role'],
        ['[Nixel](https://nixel.dev/)', 'Developer'],
        ['Fiora Sylvie', 'Assistant'],
      ]
    );

    rich.addText('You can also build content in another AIRich instance and reuse its items.');

    const items = new AIRichX(sock)
      .addProduct({
        title: 'NIXCODE',
        brand: 'Nixel',
        price: 'MessageBuilderV4.7',
        product_url: 'https://gist.github.com/ValdazGT',
        image_url: FIORA_IMG,
      })
      .addPost({
        profile_url: FIORA_PROFILE,
        title: 'Behind the build',
        username: 'nixel.dev',
        verified: true,
        caption: 'Built separately, then mixed into another AIRich message.',
        thumbnail: 'https://cdn.ornzora.eu.cc/69551181-48c0-4466-b22d-235a93db8a63-FIORA.jpg',
        url: 'https://nixel.dev/',
        source_app: 'INSTAGRAM',
      })
      .addReels({
        profile_url: FIORA_PROFILE,
        username: 'nixel.dev',
        thumbnail: 'https://cdn.ornzora.eu.cc/6b1c1b29-9b80-4cfa-9c57-d008d60e18bc-FIORA.jpg',
        url: 'https://nixel.dev/',
        verified: true,
      })
      .items;

    rich.addText('These cards came from a completely separate AIRich instance.');

    rich.addSection(AIRich.newLayout('HScroll', items));

    rich.addTip(
      'The Product and Post above were created separately, extracted with .items, then inserted here using .addSection().'
    );

    rich.addText('You can continue building underneath the mixed section normally.');

    rich.addSource([
      [FIORA_PROFILE, 'https://gist.github.com/ValdazGT/', 'MessageBuilderV4.7'],
    ]);

    rich.addReels([
      {
        profile_url: FIORA_PROFILE,
        username: 'nixel.dev',
        thumbnail: FIORA_IMG,
        url: 'https://nixel.dev/',
        verified: true,
      },
      {
        profile_url: FIORA_PROFILE,
        username: 'nixel.dev',
        thumbnail: 'https://cdn.ornzora.eu.cc/69551181-48c0-4466-b22d-235a93db8a63-FIORA.jpg',
        url: 'https://nixel.dev/',
        verified: true,
      },
      {
        profile_url: FIORA_PROFILE,
        username: 'nixel.dev',
        thumbnail: 'https://cdn.ornzora.eu.cc/6b1c1b29-9b80-4cfa-9c57-d008d60e18bc-FIORA.jpg',
        url: 'https://nixel.dev/',
        verified: true,
      },
      {
        profile_url: FIORA_PROFILE,
        username: 'nixel.dev',
        thumbnail: 'https://cdn.ornzora.eu.cc/6b07d572-8aeb-4bbe-9faa-f226bacd5c99-FIORA.jpg',
        url: 'https://nixel.dev/',
        verified: true,
      },
    ]);

    rich.addTip('Quick Actions — see the NexoraFlex repo for the source of this tour.');

    rich.addFooterLinks([{ text: 'Visit Repo', url: REPO_URL }]);

    rich.addText(
      'That’s the full MessageBuilderV4.7 tour — built live, edited live, and mixed from separate AIRich instances. 🚀\n\nFor more example code, check it out [here](https://gist.githubusercontent.com/ValdazGT/ce6532c1d4ff192bb718f1acb392d460/raw/9683ebc0ac47280c8729680ad074c3cb309d7ab5/MessageBuilderV4.6_Example-Code.js).'
    );

    await rich.send(m.from, { quoted: m });
  },
};
