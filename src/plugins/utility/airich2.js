/**
 * airich2.js — .airich2 — live AIRich (MessageBuilder) demo.
 *
 * Ported from the LUNA MD plugins/airich.js (commands `rich` / `airich`).
 * NexoraFlex already ships src/plugins/utility/rich.js, so this demo is
 * `airich2`. It builds one rich message live, editing it step by step:
 * text -> loading image -> image -> loading video -> video -> code ->
 * table -> mixed cards from a second instance -> sources -> reels ->
 * widget -> footer action -> cleanup.
 *
 * WHY THE CLASS LIVES IN THIS FILE: the demo exercises features the
 * shared house lib (src/lib/NIXCODE.js) does NOT have — sendEdit(),
 * insertAt/replace section placement, addMetadata(), addWidget() and
 * addFooterAction(). Porting the demo onto the shared lib would gut
 * it, so the LUNA AIRich class is carried over self-contained here,
 * rebranded. The house gp2 plugin already proved the shared lib works
 * for normal cards; this file is the feature tour, not a second lib.
 *
 * REBRANDED: "Nixel" / "Fiora" / nixel.dev -> NEXORA MD / nexora.dev
 * in visible text. The demo media URLs (cdn.ornzora.eu.cc) and the
 * MessageBuilder gist link are kept as-is — they are the demo's sample
 * assets / upstream attribution, not bot branding. The old owner's
 * WhatsApp channel link in the footer action is replaced by
 * https://nexora.dev (no hardcoded channel links).
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `conn` -> `sock`,
 *     `m.chat` -> `m.from`. `delay` is a local helper (not imported
 *     from baileys).
 *   - Branding: NEXORA MD (see above).
 */
import { generateWAMessageFromContent, generateMessageIDV2 } from 'baileys';
import crypto from 'crypto';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class AIRich {
  #client;
  constructor(client) {
    if (!client) throw new Error('Socket is required');
    this.#client = client;
    this._title = '';
    this._footer = '';
    this._contextInfo = {};
    this._map = new Map(); // id -> index
    this._sections = []; // { id, layout, sub }
    this._richResponseSources = [];
    this._lastKey = null;
    this._lastJid = null;
  }

  setTitle(t) { this._title = t; return this; }
  setFooter(t) { this._footer = t; return this; }
  setContextInfo(o) { this._contextInfo = o; return this; }
  get items() { return this._sections.map((s) => s.layout.view_model); }

  static newLayout(name, data) {
    return {
      view_model: {
        [Array.isArray(data) ? 'primitives' : 'primitive']: data,
        __typename: `GenAI${name}LayoutViewModel`,
      },
    };
  }

  _upsert(id, layout, sub = null, opts = {}) {
    const { insertAt, replace } = opts || {};
    if (replace) {
      const idx = this._sections.findIndex((x) => x.id === replace);
      if (idx !== -1) {
        this._sections[idx] = { id: id || replace, layout, sub };
        return this;
      }
    }
    if (id && this._map.has(id)) {
      const idx = this._sections.findIndex((x) => x.id === id);
      if (idx !== -1) { this._sections[idx] = { id, layout, sub }; return this; }
    }
    const newItem = { id: id || crypto.randomUUID(), layout, sub };
    if (insertAt) {
      const idx = this._sections.findIndex((x) => x.id === insertAt);
      if (idx !== -1) { this._sections.splice(idx + 1, 0, newItem); return this; }
    }
    this._sections.push(newItem);
    return this;
  }

  addText(text, opts = {}) {
    const sub = { messageType: 2, messageText: text };
    const layout = AIRich.newLayout('Single', { text, __typename: 'GenAIMarkdownTextUXPrimitive' });
    return this._upsert(opts.id, layout, sub, opts);
  }

  addTip(text, opts = {}) {
    const sub = { messageType: 2, messageText: text };
    const layout = AIRich.newLayout('Single', { text, __typename: 'GenAIMetadataTextPrimitive' });
    return this._upsert(opts.id, layout, sub, opts);
  }

  addMetadata(text, opts = {}) {
    return this.addTip(text, opts);
  }

  addSuggest(arr, opts = {}) {
    const a = Array.isArray(arr) ? arr : [arr];
    const layout = AIRich.newLayout('ActionRow', a.map((t) => ({
      prompt_text: t, prompt_type: 'SUGGESTED_PROMPT',
      __typename: 'GenAIFollowUpSuggestionPillPrimitive',
    })));
    return this._upsert(opts.id, layout, null, opts);
  }

  addCode(lang, code, opts = {}) {
    const meta = AIRich.tokenizer(code, lang);
    const sub = { messageType: 5, codeMetadata: { codeLanguage: lang, codeBlocks: meta.codeBlock } };
    const layout = AIRich.newLayout('Single', { language: lang, code_blocks: meta.unified_codeBlock, __typename: 'GenAICodeUXPrimitive' });
    return this._upsert(opts.id, layout, sub, opts);
  }

  addTable(table, opts = {}) {
    const meta = AIRich.toTableMetadata(table);
    const sub = { messageType: 4, tableMetadata: { title: meta.title, rows: meta.rows } };
    const layout = AIRich.newLayout('Single', { rows: meta.unified_rows, __typename: 'GenATableUXPrimitive' });
    return this._upsert(opts.id, layout, sub, opts);
  }

  addImage(urlOrEmpty, opts = {}) {
    const isGenerating = !urlOrEmpty;
    const url = urlOrEmpty || 'https://placehold.co/600x400';
    const status = opts.status || (isGenerating ? 'GENERATING' : 'READY');
    const sub = { messageType: 1, gridImageMetadata: { gridImageUrl: { imagePreviewUrl: url }, imageUrls: [{ imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: 'https://nexora.dev/' }] } };
    const layout = AIRich.newLayout('Single', {
      media: { url, mime_type: 'image/png' },
      imagine_type: 'IMAGE',
      status: { status, update_text: opts.update_text || '', estimated_time_remaining: opts.estimatedTime || 0 },
      __typename: 'GenAIImaginePrimitive',
    });
    return this._upsert(opts.id, layout, sub, opts);
  }

  addVideo(urlOrEmpty, opts = {}) {
    const url = urlOrEmpty || 'https://placehold.co/600x400.mp4';
    const status = opts.status || (!urlOrEmpty ? 'GENERATING' : 'READY');
    const sub = { messageType: 2, messageText: '[ CANNOT_LOAD_VIDEO ]' };
    const layout = AIRich.newLayout('Single', {
      media: { url, mime_type: 'video/mp4', duration: 0 },
      imagine_type: 'ANIMATE',
      status: { status, estimated_time_remaining: opts.estimatedTime || 0 },
      __typename: 'GenAIImaginePrimitive',
    });
    return this._upsert(opts.id, layout, sub, opts);
  }

  addSource(sources = [], opts = {}) {
    let src = sources;
    if (Array.isArray(sources) && sources.length && typeof sources[0] === 'object' && !Array.isArray(sources[0])) {
      src = sources.map((s) => [s.icon || s.favicon || '', s.url || '', s.title || '']);
    }
    if (src.every((i) => typeof i === 'string')) src = [src];
    const mapped = src.map(([p, u, t]) => ({
      source_type: 'THIRD_PARTY', source_display_name: t || '', source_subtitle: 'AI', source_url: u || '',
      favicon: { url: p || '', mime_type: 'image/jpeg', width: 16, height: 16 },
    }));
    const layout = AIRich.newLayout('Single', { sources: mapped, __typename: 'GenAISearchResultPrimitive' });
    return this._upsert(opts.id, layout, null, opts);
  }

  addProduct(data = {}, opts = {}) {
    const items = Array.isArray(data) ? data : [data];
    const sub = { messageType: 2, messageText: '[ CANNOT_LOAD_PRODUCT ]' };
    const product = items.map((item) => ({
      title: item.title, brand: item.brand, price: item.price, sale_price: item.sale_price,
      product_url: item.product_url || item.url,
      image: { url: item.image_url || item.image },
      additional_images: [{ url: item.icon_url || item.icon }],
      __typename: 'GenAIProductItemCardPrimitive',
    }));
    const layout = AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0]);
    return this._upsert(opts.id, layout, sub, opts);
  }

  addPost(data = {}, opts = {}) {
    const posts = Array.isArray(data) ? data : [data];
    const sub = { messageType: 2, messageText: '[ CANNOT_LOAD_POST ]' };
    const layout = AIRich.newLayout('HScroll', posts.map((p) => ({
      title: p.title || '', subtitle: p.subtitle || '', username: p.username || '',
      profile_picture_url: p.profile || p.profile_picture_url || p.profile_url || '',
      is_verified: !!(p.verified || p.is_verified),
      thumbnail_url: p.thumbnail || p.thumbnail_url || '',
      post_caption: p.caption || p.post_caption || '',
      likes_count: p.likes_count || 0, comments_count: p.comments_count || 0, shares_count: p.shares_count || 0,
      post_url: p.url || p.post_url || '', post_deeplink: p.deeplink || '', source_app: p.source_app || 'INSTAGRAM',
      footer_label: '', footer_icon: '', is_carousel: posts.length > 1, orientation: 'LANDSCAPE', post_type: 'VIDEO',
      __typename: 'GenAIPostPrimitive',
    })));
    return this._upsert(opts.id, layout, sub, opts);
  }

  addReels(reelsItems = [], opts = {}) {
    const arr = Array.isArray(reelsItems) ? reelsItems : [reelsItems];
    const sub = {
      messageType: 9,
      contentItemsMetadata: {
        contentType: 1,
        itemsMetadata: arr.map((item) => ({
          reelItem: {
            title: item.username || '', profileIconUrl: item.profile || item.profileIconUrl || '',
            thumbnailUrl: item.thumbnail || item.thumbnailUrl || '', videoUrl: item.url || item.videoUrl || '',
          },
        })),
      },
    };
    const layout = AIRich.newLayout('HScroll', arr.map((item) => ({
      reels_url: item.url || item.videoUrl || '', thumbnail_url: item.thumbnail || item.thumbnailUrl || '',
      creator: item.username || '', avatar_url: item.profile || item.profileIconUrl || '',
      reels_title: item.title || '', likes_count: 0, shares_count: 0, view_count: 0, reel_source: 'IG',
      is_verified: !!(item.verified), __typename: 'GenAIReelPrimitive',
    })));
    return this._upsert(opts.id, layout, sub, opts);
  }

  addSection(layout, opts = {}) {
    // layout already is view_model wrapper
    const wrapped = layout.view_model ? layout : { view_model: layout };
    return this._upsert(opts.id, wrapped, null, opts);
  }

  addWidget(widget, opts = {}) { const layout = AIRich.newLayout('Single', { ...widget, __typename: 'GenAIWidgetPrimitive' }); return this._upsert(opts.id, layout, null, opts); }
  addFooterAction(action, opts = {}) { const layout = AIRich.newLayout('Single', { ...action, __typename: 'GenAIFooterActionPrimitive' }); return this._upsert(opts.id, layout, null, opts); }

  delete(id) { this._sections = this._sections.filter((x) => x.id !== id); return this; }

  build(jid, { forwarded = true, quoted, ...options } = {}) {
    const forward = forwarded ? { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4 } : {};
    const qObj = quoted ? { stanzaId: quoted?.key?.id || quoted?.id, participant: quoted?.key?.participant || quoted?.key?.remoteJid, quotedType: 0, quotedMessage: quoted.message ?? quoted } : {};
    const sections = this._footer ? [...this._sections.map((s) => s.layout), AIRich.newLayout('Single', { text: this._footer, __typename: 'GenAIMetadataTextPrimitive' })] : this._sections.map((s) => s.layout);
    const submessages = this._sections.map((s) => s.sub).filter(Boolean);
    const message = {
      messageContextInfo: {
        deviceListMetadata: {}, deviceListMetadataVersion: 2,
        botMetadata: { messageDisclaimerText: this._title, richResponseSourcesMetadata: { sources: this._richResponseSources } },
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1, submessages,
            unifiedResponse: { data: Buffer.from(JSON.stringify({ response_id: crypto.randomUUID(), sections })).toString('base64') },
            contextInfo: { ...forward, ...qObj, ...this._contextInfo },
          },
        },
      },
    };
    return generateWAMessageFromContent(jid, message, { messageId: this._lastKey?.id || generateMessageIDV2(), ...options });
  }

  async send(jid, options = {}) {
    const msg = this.build(jid, options);
    this._lastKey = msg.key;
    this._lastJid = jid;
    return this.#client.relayMessage(jid, msg.message, { messageId: msg.key.id, ...options });
  }

  async sendEdit(options = {}) {
    if (!this._lastKey) throw new Error('No message to edit');
    const msg = this.build(this._lastJid, { ...options, messageId: this._lastKey.id });
    return this.#client.relayMessage(this._lastJid, msg.message, { messageId: this._lastKey.id, ...options });
  }

  static tokenizer(code, lang = 'javascript') {
    const keywords = new Set(['break', 'case', 'catch', 'continue', 'debugger', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'true', 'false', 'null', 'undefined', 'class', 'const', 'let', 'super', 'extends', 'export', 'import', 'yield', 'static', 'constructor', 'async', 'await', 'get', 'set']);
    const TYPE_MAP = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' };
    const tokens = [];
    let i = 0;
    const push = (content, type) => {
      if (!content) return;
      const last = tokens[tokens.length - 1];
      if (last && last.highlightType === type) last.codeContent += content;
      else tokens.push({ codeContent: content, highlightType: type });
    };
    while (i < code.length) {
      const c = code[i];
      if (/\s/.test(c)) { let s = i; while (i < code.length && /\s/.test(code[i])) i++; push(code.slice(s, i), 0); continue; }
      if (c === '/' && code[i + 1] === '/') { let s = i; i += 2; while (i < code.length && code[i] !== '\n') i++; push(code.slice(s, i), 5); continue; }
      if (c === '"' || c === "'" || c === '`') { let s = i; const q = c; i++; while (i < code.length) { if (code[i] === '\\' && i + 1 < code.length) i += 2; else if (code[i] === q) { i++; break; } else i++; } push(code.slice(s, i), 3); continue; }
      if (/[0-9]/.test(c)) { let s = i; while (i < code.length && /[0-9.]/.test(code[i])) i++; push(code.slice(s, i), 4); continue; }
      if (/[a-zA-Z_$]/.test(c)) {
        let s = i; while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
        const word = code.slice(s, i);
        let type = 0;
        if (keywords.has(word)) type = 1;
        else { let j = i; while (j < code.length && /\s/.test(code[j])) j++; if (code[j] === '(') type = 2; }
        push(word, type); continue;
      }
      push(c, 0); i++;
    }
    return { codeBlock: tokens, unified_codeBlock: tokens.map((t) => ({ content: t.codeContent, type: TYPE_MAP[t.highlightType] })) };
  }

  static toTableMetadata(arr) {
    const [header, ...rows] = arr;
    const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
    const normalize = (r) => [...r, ...new Array(maxLen - r.length).fill('')];
    const unified_rows = [{ is_header: true, cells: normalize(header) }, ...rows.map((r) => ({ is_header: false, cells: normalize(r) }))];
    return { title: '', rows: unified_rows.map((r) => ({ items: r.cells, ...(r.is_header ? { isHeading: true } : {}) })), unified_rows };
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default {
  name: 'airich2',
  aliases: [],
  category: 'utility',
  description: 'Live tour of the AIRich rich-message builder — builds and edits one message step by step.',
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    const rich = new AIRich(sock)
      .setTitle('MessageBuilderV4.7')
      .addText('Hey! Welcome to [MessageBuilderV4.7](https://gist.github.com/ValdazGT) 👋', { id: 'intro' })
      .setFooter('Built with MessageBuilderV4.7');

    await rich.send(m.from, { quoted: m });
    await delay(1500);

    rich.addText('This is a live tour of MessageBuilderV4.7. Everything below will be built directly into this message.', { insertAt: 'intro', id: 'welcome' });
    rich.addSuggest(['MessageBuilderV4.7', 'Dynamic AIRich', 'NEXORA MD']);
    await rich.sendEdit();
    await delay(1800);

    rich.addText('First, loading states. The item appears first, then gets replaced when the content is ready.', { insertAt: 'welcome', id: 'loading_intro' });
    await rich.sendEdit();
    await delay(1500);

    rich.addImage('', { status: 'GENERATING', update_text: 'Generating image...', insertAt: 'loading_intro', id: 'image1' });
    await rich.sendEdit();
    await delay(3000);

    rich.addImage('https://cdn.ornzora.eu.cc/2a639cd2-5c33-49e3-982f-77f471c9313f-FIORA.jpg', { replace: 'image1' });
    await rich.sendEdit();
    await delay(2000);

    rich.addText('Video supports the same loading → replace flow.', { insertAt: 'image1', id: 'video_intro' });
    await rich.sendEdit();
    await delay(1500);

    rich.addVideo('', { status: 'GENERATING', estimatedTime: 3000, insertAt: 'video_intro', id: 'video1' });
    await rich.sendEdit();
    await delay(4000);

    rich.addVideo('https://cdn.ornzora.eu.cc/3bb12237-2365-4a76-a4e2-635faea6d54c-FIORA.mp4', { replace: 'video1' });
    await rich.sendEdit();
    await delay(2000);

    rich.addText('Now for code blocks with syntax highlighting.', { insertAt: 'video1', id: 'code_intro' });
    await rich.sendEdit();
    await delay(1200);

    rich.addCode('javascript', `function greet(name) {\n\treturn \`Hello, \${name}!\`\n}\n\ngreet('NEXORA MD')`, { insertAt: 'code_intro', id: 'code1' });
    await rich.sendEdit();
    await delay(2500);

    rich.addText('Tables are supported too.', { insertAt: 'code1', id: 'table_intro' });
    await rich.sendEdit();
    await delay(1200);

    rich.addTable([['Name', 'Role'], ['[NEXORA MD](https://nexora.dev/)', 'Developer'], ['NEXORA MD', 'Assistant']], { insertAt: 'table_intro', id: 'table1' });
    await rich.sendEdit();
    await delay(2500);

    rich.addText('You can also build content in another AIRich instance and reuse its items.', { insertAt: 'table1', id: 'mix_intro' });
    await rich.sendEdit();
    await delay(1800);

    const items = new AIRich(sock)
      .addProduct({ title: 'NEXORA MD', brand: 'NEXORA MD', price: 'MessageBuilderV4.7', product_url: 'https://gist.github.com/ValdazGT', image_url: 'https://cdn.ornzora.eu.cc/2a639cd2-5c33-49e3-982f-77f471c9313f-FIORA.jpg' })
      .addPost({ profile: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', title: 'Behind the build', username: 'nexora.dev', verified: true, caption: 'Built separately, then mixed into another AIRich message.', thumbnail: 'https://cdn.ornzora.eu.cc/69551181-48c0-4466-b22d-235a93db8a63-FIORA.jpg', url: 'https://nexora.dev/', source_app: 'INSTAGRAM' })
      .addReels({ profile: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', username: 'nexora.dev', thumbnail: 'https://cdn.ornzora.eu.cc/6b1c1b29-9b80-4cfa-9c57-d008d60e18bc-FIORA.jpg', url: 'https://nexora.dev/', verified: true }).items;

    rich.addText('These cards came from a completely separate AIRich instance.', { insertAt: 'mix_intro', id: 'mix_note' });
    await rich.sendEdit();
    await delay(1500);

    rich.addSection(AIRich.newLayout('HScroll', items), { insertAt: 'mix_note', id: 'mixed_items' });
    await rich.sendEdit();
    await delay(3000);

    rich.addTip('The Product and Post above were created separately, extracted with .items, then inserted here using .addSection().', { insertAt: 'mixed_items', id: 'mix_explain' });
    await rich.sendEdit();
    await delay(2500);

    rich.addText('You can continue building underneath the mixed section normally.', { insertAt: 'mix_explain', id: 'after_mix' });
    await rich.sendEdit();
    await delay(1800);

    rich.addSource([{ icon: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', url: 'https://gist.github.com/ValdazGT/', title: 'MessageBuilderV4.7', subtitle: 'GitHub Gist · MessageBuilder' }], { insertAt: 'after_mix', id: 'source1' });
    await rich.sendEdit();
    await delay(1800);

    rich.addReels([
      { profile: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', username: 'nexora.dev', thumbnail: 'https://cdn.ornzora.eu.cc/2a639cd2-5c33-49e3-982f-77f471c9313f-FIORA.jpg', url: 'https://nexora.dev/', verified: true },
      { profile: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', username: 'nexora.dev', thumbnail: 'https://cdn.ornzora.eu.cc/69551181-48c0-4466-b22d-235a93db8a63-FIORA.jpg', url: 'https://nexora.dev/', verified: true },
      { profile: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', username: 'nexora.dev', thumbnail: 'https://cdn.ornzora.eu.cc/6b1c1b29-9b80-4cfa-9c57-d008d60e18bc-FIORA.jpg', url: 'https://nexora.dev/', verified: true },
      { profile: 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg', username: 'nexora.dev', thumbnail: 'https://cdn.ornzora.eu.cc/6b07d572-8aeb-4bbe-9faa-f226bacd5c99-FIORA.jpg', url: 'https://nexora.dev/', verified: true },
    ], { insertAt: 'source1', id: 'reels1' });
    await rich.sendEdit();
    await delay(2200);

    rich.addWidget({ title: 'Quick Actions', sections: [], actions: [{ label: 'Visit NEXORA', kind: 'OTHER', state: 'PENDING', id: 'nexora' }] }, { insertAt: 'reels1', id: 'widget1' });
    await rich.sendEdit();
    await delay(2000);

    rich.addFooterAction({ text: 'Visit NEXORA', url: 'https://nexora.dev' }, { id: 'footer1' });
    await rich.sendEdit();
    await delay(2500);

    rich.addMetadata('That is the basic workflow: create, insert, replace, mix, and continue building downward in the same editable message.', { id: 'cleanup_intro', insertAt: 'reels1' });
    await rich.sendEdit();
    await delay(3000);

    rich.delete('cleanup_intro');
    await rich.sendEdit();
    await delay(400);

    rich.addText('That’s the full MessageBuilderV4.7 tour — built live, edited live, and mixed from separate AIRich instances. 🚀\n\nFor more example code, check it out [here](https://gist.githubusercontent.com/ValdazGT/ce6532c1d4ff192bb718f1acb392d460/raw/9683ebc0ac47280c8729680ad074c3cb309d7ab5/MessageBuilderV4.6_Example-Code.js).', { insertAt: 'widget1', id: 'final' });
    await rich.sendEdit();
  },
};
