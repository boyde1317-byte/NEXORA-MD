/**
 * @file src/lib/richTestKit.js
 *
 * Test harness for the OURIN-baileys rich message generators ported into
 * the fork's lib/Utils/rich-message-utils.js.  These generators build
 * botForwardedMessage / richResponseMessage content directly — a different
 * approach from the fork's native prepareRichResponseMessage path used by
 * baileysBridge.sendRichResponse().
 *
 * This module is ONLY for testing.  It is not wired into any real command
 * or menu.  Use the `.testrich` owner-only plugin to exercise every generator.
 */

import {
  generateWAMessageFromContent,
} from 'baileys';

// ── V1 + V2 generators (imported from the fork's rich-message-utils.js) ─────
import {
  generateTableContent,
  generateListContent,
  generateCodeBlockContent,
  generateLatexContent,
  captureUnifiedResponse,
  generateUnifiedResponseContent,
  generateRichMessageContent,
  // V2 generators (base64-encoded unifiedResponse — Meta AI format)
  tokenizeCodeV2,
  toTableMetadataV2,
  generateTableContentV2,
  generateCodeBlockContentV2,
  generateLinkContent,
  generateLinkContentV2,
  generateReelContent,
  generateReelWithStats,
  generateMapContent,
  generateInlineImageWithTable,
  generateInlineVideoWithStats,
  // V2 generators (base64-encoded unifiedResponse — Meta AI format)
  generateListContentV2,
  generateLatexContentV2,
  generateMapContentV2,
  generateReelContentV2,
  generateReelWithStatsV2,
  generateInlineImageWithTableV2,
  generateInlineVideoWithStatsV2,
  // GRID_IMAGE + DYNAMIC (V1 + V2)
  generateGridImageContent,
  generateDynamicContent,
  generateGridImageContentV2,
  generateDynamicContentV2,
} from 'baileys';

// ─────────────────────────────────────────────────────────────────────────────
// Relay helper — takes a { message, messageId } from any generator and
// sends it via sock.relayMessage (bypasses sendMessage's content processing
// so the raw botForwardedMessage structure reaches WA servers untouched).
// ─────────────────────────────────────────────────────────────────────────────

async function _relayGenerated(sock, jid, generated, options = {}) {
  const message = await generateWAMessageFromContent(jid, generated.message, {
    userJid: sock.user?.id || '0@s.whatsapp.net',
    quoted: options.quoted,
  });
  await sock.relayMessage(jid, message.message, { messageId: message.key.id });
  return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test definitions — each returns a human-readable label + the relay result.
// All are async because some generators are async (latex image upload).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Table — submessage-based table with heading row.
 */
export async function testV1Table(sock, jid, quoted) {
  const generated = generateTableContent(
    'NEXORA Feature Matrix',
    ['Feature', 'Status', 'Notes'],
    [
      ['Interactive Buttons', '✅', 'nativeFlow'],
      ['Carousels',          '✅', 'albumMessage'],
      ['Rich Tables',        '🧪', 'V1 submessage'],
      ['Rich Code',          '🧪', 'V1 submessage'],
      ['LaTeX',              '🧪', 'requires renderer'],
    ],
    quoted,
    { headerText: '🧪 V1 Table Generator Test', footer: 'NEXORA-MD • itsliaaa fork + OURIN port' },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 table ✓';
}

/**
 * V1 List — flat list as a single-column table.
 */
export async function testV1List(sock, jid, quoted) {
  const generated = generateListContent(
    'Command Categories',
    [
      ['General', 'ping, about, menu'],
      ['Utility', 'encode, decode, qr'],
      ['Media',   'sticker, toimg, tourl'],
      ['Economy', 'daily, balance, top'],
      ['Owner',   'eval, restart, testmessage'],
      ['AI',      'ai, gpt, dalle'],
    ],
    quoted,
    { headerText: '🧪 V1 List Generator Test', footer: 'NEXORA-MD' },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 list ✓';
}

/**
 * V1 Code block — syntax-highlighted JavaScript.
 */
export async function testV1Code(sock, jid, quoted) {
  const code = [
    "import { baileysBridge } from './src/core/baileysBridge.js';",
    '',
    '// Send an interactive card with quick_reply buttons',
    'await baileysBridge.sendInteractive(sock, jid, {',
    "  body: 'Hello from NEXORA!',",
    "  footer: 'Powered by itsliaaa fork',",
    '  buttons: [',
    "    { name: 'quick_reply', params: { text: 'Ping', id: '.ping' } },",
    "    { name: 'cta_url',     params: { text: 'GitHub', url: 'https://github.com/boyde1317-byte' } },",
    '  ],',
    '});',
  ].join('\n');
  const generated = generateCodeBlockContent(code, quoted, {
    title: '🧪 V1 Code Block Test',
    footer: 'Syntax: JavaScript',
    language: 'javascript',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 code ✓';
}

/**
 * V1 Code block — Python (exercises extended keyword sets).
 */
export async function testV1Python(sock, jid, quoted) {
  const code = [
    'import asyncio',
    'from nexora import Bot',
    '',
    'async def main():',
    '    bot = Bot(prefix=".")',
    '    await bot.start()',
    '    print("NEXORA-MD is running!")',
    '',
    'if __name__ == "__main__":',
    '    asyncio.run(main())',
  ].join('\n');
  const generated = generateCodeBlockContent(code, quoted, {
    title: '🧪 V1 Python Code Test',
    footer: 'Syntax: Python — extended keywords',
    language: 'python',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 python ✓';
}

/**
 * V1 LaTeX — inline expression (no image upload, just the metadata).
 */
export async function testV1Latex(sock, jid, quoted) {
  const generated = generateLatexContent(quoted, {
    text: '🧪 V1 LaTeX Test — quadratic formula:',
    expressions: [
      {
        latexExpression: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        url: '',
        width: 200,
        height: 60,
      },
    ],
    headerText: 'LaTeX Expression',
    footer: 'NEXORA-MD • requires client-side LaTeX rendering',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 latex ✓';
}

/**
 * V1 Rich Message — raw submessages (manual construction).
 */
export async function testV1Raw(sock, jid, quoted) {
  const submessages = [
    { messageType: 2, messageText: '🧪 V1 Raw Submessage Test' },
    { messageType: 2, messageText: 'This message was built from manually-constructed submessages.' },
    {
      messageType: 4,
      tableMetadata: {
        title: 'Submessage Types',
        rows: [
          { items: ['Type', 'ID', 'Description'], isHeading: true },
          { items: ['TEXT', '2', 'Plain text line'] },
          { items: ['TABLE', '4', 'Structured table'] },
          { items: ['CODE', '5', 'Syntax-highlighted code'] },
          { items: ['LATEX', '8', 'LaTeX expression'] },
        ],
      },
    },
    { messageType: 2, messageText: '_NEXORA-MD_ — testing raw submessage assembly.' },
  ];
  const generated = generateRichMessageContent(submessages, quoted);
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 raw ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 Generators (base64-encoded unifiedResponse — Meta AI format)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V2 Table — uses toTableMetadataV2 string parsing + base64 unifiedResponse.
 */
export async function testV2Table(sock, jid, quoted) {
  // Format: [title, "header1|header2|header3", "row1col1,row1col2;;row2col1,row2col2"]
  const table = [
    'NEXORA V2 Table',
    'Plugin | Category | Status',
    'ping | general | ✅\n;; about | general | ✅\n;; menu | general | ✅\n;; sticker | media | ✅\n;; daily | economy | ✅\n;; eval | owner | 🔒',
  ];
  const generated = generateTableContentV2(table, quoted, {
    headerText: '🧪 V2 Table Generator',
    footer: 'base64 unifiedResponse — Meta AI format',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 table ✓';
}

/**
 * V2 Code block — base64-encoded code with improved tokenizer.
 */
export async function testV2Code(sock, jid, quoted) {
  const code = [
    '// V2 Code Block — improved tokenizer with Python/Go/Lua/Bash support',
    "const { tokenizeCodeV2 } = require('baileys');",
    '',
    "const { codeBlock, unified_codeBlock } = tokenizeCodeV2(code, 'javascript');",
    'console.log(unified_codeBlock);',
    '// → [{ content: "const", type: "KEYWORD" }, { content: " ", type: "DEFAULT" }, ...]',
  ].join('\n');
  const generated = generateCodeBlockContentV2(code, quoted, {
    title: '🧪 V2 Code Block',
    language: 'javascript',
    footer: 'base64 unifiedResponse — improved tokenizer',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 code ✓';
}

/**
 * V2 Code block — Go (exercises Go keyword set).
 */
export async function testV2Go(sock, jid, quoted) {
  const code = [
    'package main',
    '',
    'import "fmt"',
    '',
    'func main() {',
    '    fmt.Println("NEXORA-MD — V2 Go syntax test")',
    '}',
  ].join('\n');
  const generated = generateCodeBlockContentV2(code, quoted, {
    title: '🧪 V2 Go Code',
    language: 'go',
    footer: 'Go keyword highlighting — V2 tokenizer',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 go ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// Link content with citations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Link — inline link entities with citations and proofs.
 */
export async function testV1Link(sock, jid, quoted) {
  const generated = generateLinkContent(
    'NEXORA-MD uses a custom Baileys fork with rich message support. The fork extends itsliaaa/Baileys with OURIN-baileys generators for tables, code blocks, and LaTeX.',
    [
      { url: 'https://github.com/boyde1317-byte/baileys', displayName: 'Baileys Fork' },
      { url: 'https://github.com/boyde1317-byte/NEXORA-MD', displayName: 'NEXORA-MD' },
    ],
    quoted,
    {
      footer: 'NEXORA-MD • link content with citations',
      citations: [
        { sourceTitle: 'GitHub — boyde1317-byte/baileys', sourceQuery: 'baileys fork rich messages', citationNumber: 1 },
        { sourceTitle: 'GitHub — boyde1317-byte/NEXORA-MD', sourceQuery: 'NEXORA MD bot', citationNumber: 2 },
      ],
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 link ✓';
}

/**
 * V2 Link — search-engine-style citations with GenAISearchCitationItem.
 */
export async function testV2Link(sock, jid, quoted) {
  const generated = generateLinkContentV2(
    'NEXORA-MD is a next-gen WhatsApp bot built on a custom Baileys fork. It supports nativeFlow interactive messages, carousels, sticker packs, and rich response messages.',
    [
      {
        url: 'https://github.com/boyde1317-byte/NEXORA-MD',
        displayName: 'NEXORA-MD on GitHub',
        sourceDisplayName: 'GitHub',
        sourceSubtitle: 'boyde1317-byte/NEXORA-MD',
      },
      {
        url: 'https://github.com/boyde1317-byte/baileys',
        displayName: 'Baileys Fork on GitHub',
        sourceDisplayName: 'GitHub',
        sourceSubtitle: 'boyde1317-byte/baileys',
      },
    ],
    quoted,
    {
      footer: 'NEXORA-MD • V2 search citations',
      searchEngine: 'MAME',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 link ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer unit tests (no relay — just validates output)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokenizer V2 — validate that tokenizeCodeV2 produces correct highlight types.
 */
export async function testTokenizerV2(sock, jid, quoted) {
  const code = 'const x = 42; // comment\nfunction hello(name) { return "world"; }';
  const { codeBlock, unified_codeBlock } = tokenizeCodeV2(code, 'javascript');

  const hasKeyword  = unified_codeBlock.some(t => t.type === 'KEYWORD');
  const hasString   = unified_codeBlock.some(t => t.type === 'STRING');
  const hasNumber   = unified_codeBlock.some(t => t.type === 'NUMBER');
  const hasComment  = unified_codeBlock.some(t => t.type === 'COMMENT');
  const hasMethod   = unified_codeBlock.some(t => t.type === 'METHOD');

  const report = [
    '🧪 *V2 Tokenizer Test*',
    '',
    '*Code:*',
    '```' + code + '```',
    '',
    '*Results:*',
    '• KEYWORD detected: ' + (hasKeyword ? '✅' : '❌'),
    '• STRING detected:  ' + (hasString ? '✅' : '❌'),
    '• NUMBER detected:  ' + (hasNumber ? '✅' : '❌'),
    '• COMMENT detected: ' + (hasComment ? '✅' : '❌'),
    '• METHOD detected:  ' + (hasMethod ? '✅' : '❌'),
    '• Total tokens:     ' + codeBlock.length,
    '• Unified entries:  ' + unified_codeBlock.length,
    '',
    '_All checks ' + (hasKeyword && hasString && hasNumber && hasComment && hasMethod ? 'PASSED ✅' : 'FAILED ❌') + '_',
  ].join('\n');

  await sock.sendMessage(jid, { text: report }, { quoted });
  return 'tokenizer V2 ✓';
}

/**
 * Table metadata V2 — validate string parsing with | and ;; delimiters.
 */
export async function testTableMetadataV2(sock, jid, quoted) {
  const input = [
    'Test Table',
    'A | B | C',
    '1,2,3;;4,5,6;;7,8,9',
  ];
  const result = toTableMetadataV2(input);

  const report = [
    '🧪 *V2 Table Metadata Parser Test*',
    '',
    '*Input:*',
    '```' + JSON.stringify(input, null, 2) + '```',
    '',
    '*Output:*',
    '```' + JSON.stringify(result, null, 2) + '```',
    '',
    '• Title:      ' + result.title,
    '• Row count:  ' + result.rows.length,
    '• Has header: ' + (result.rows[0]?.isHeading ? '✅' : '❌'),
  ].join('\n');

  await sock.sendMessage(jid, { text: report }, { quoted });
  return 'table metadata V2 ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified response capture & relay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture & relay — builds a V1 message, captures the unified response,
 * and regenerates it. This tests the captureUnifiedResponse and
 * generateUnifiedResponseContent round-trip.
 */
export async function testCaptureRelay(sock, jid, quoted) {
  // Build a V1 table
  const original = generateTableContent(
    'Capture & Relay Test',
    ['Field', 'Value'],
    [
      ['Generator', 'V1 table'],
      ['Method', 'captureUnifiedResponse -> generateUnifiedResponseContent'],
      ['Round-trip', 'should preserve submessages'],
    ],
    quoted,
    { headerText: '🧪 Capture & Relay Round-Trip' },
  );

  // Simulate receiving this message (build a fake msg object)
  const fakeMsg = original.message;

  // Capture
  const captured = captureUnifiedResponse(fakeMsg);
  if (!captured) {
    await sock.sendMessage(jid, {
      text: '🧪 *Capture & Relay Test*\n\n❌ captureUnifiedResponse returned null — no unifiedResponse data found.\n\n_Note: Since fork commit ae26d2e, V1 generators also embed unifiedResponse.data (protobuf-encoded). If this fails, the message may predate that fix._',
    }, { quoted });
    return 'capture relay — no unifiedResponse found';
  }

  // Regenerate
  const regenerated = generateUnifiedResponseContent(quoted, captured);
  await _relayGenerated(sock, jid, regenerated, { quoted });
  return 'capture relay ✓';
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Reel / Content Items generators (video + thumbnail carousel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reel content — video carousel using contentItemsMetadata + ReelItem proto.
 * Each item has a thumbnail, video URL, profile icon, and title.
 */
export async function testReelContent(sock, jid, quoted) {
  const reels = [
    {
      title:          'NEXORA-MD Demo Video',
      profileIconUrl: 'https://i.pravatar.cc/150?img=12',
      thumbnailUrl:   'https://picsum.photos/id/237/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
    {
      title:          'Interactive Menu Showcase',
      profileIconUrl: 'https://i.pravatar.cc/150?img=13',
      thumbnailUrl:   'https://picsum.photos/id/238/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
  ];
  const generated = generateReelContentV2(reels, quoted, {
    headerText: '🧪 Reel Content Test — Video Carousel',
    footer: 'NEXORA-MD • contentItemsMetadata (type 9)',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'reel content ✓';
}

/**
 * Reel + Stats — the TikTok download pattern: video carousel + stats table
 * combined in a single botForwardedMessage.
 */
export async function testReelWithStats(sock, jid, quoted) {
  const params = {
    reels: [
      {
        title:          'TikTok @user/video/123456',
        profileIconUrl: 'https://i.pravatar.cc/150?img=14',
        thumbnailUrl:   'https://picsum.photos/id/239/400/600',
        videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
      },
    ],
    tableTitle: 'Download Stats',
    tableHeaders: ['Metric', 'Value'],
    tableRows: [
      ['Views',     '1,234,567'],
      ['Likes',     '45,678'],
      ['Comments',  '1,234'],
      ['Shares',    '3,210'],
      ['Downloads', '890'],
      ['Duration',  '00:58'],
      ['Quality',   'HD (720p)'],
    ],
  };
  const generated = generateReelWithStatsV2(params, quoted, {
    headerText: '🧪 Reel + Stats Table — TikTok Download Pattern',
    footer: 'NEXORA-MD • contentItems (type 9) + table (type 4) combined',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'reel + stats ✓';
}
/**
 * Location Card — AIRichResponseMapMetadata (messageType 7). Renders a
 * map preview with one or more pins, matching Meta AI's "Location Card"
 * component (e.g. "coffee shops near me in Accra").
 */
export async function testMapContent(sock, jid, quoted) {
  const generated = generateMapContent(
    {
      centerLatitude: 5.6037,
      centerLongitude: -0.1870,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
      annotations: [
        { latitude: 5.6050, longitude: -0.1880, title: 'Cafe One', body: 'Independence Ave' },
        { latitude: 5.6020, longitude: -0.1860, title: 'Cafe Two', body: 'Ring Road Central' },
      ],
      showInfoList: true,
    },
    quoted,
    {
      headerText: '🧪 Location Card Test — Coffee shops near Accra',
      footer: 'NEXORA-MD • mapMetadata (type 7)',
    }
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'map content ✓';
}

/**
 * Inline Video + Table — ContentType.DEFAULT (not CAROUSEL). This is the
 * exact layout Meta AI showed us: a single embedded video player sitting
 * above a stats table, not a swipeable carousel. Uses the same proto
 * contentItemsMetadata but with contentType=0 instead of 1.
 */
export async function testInlineVideoWithStats(sock, jid, quoted) {
  const generated = generateInlineVideoWithStatsV2(
    {
      video: {
        title:          'TikTok @user/video/123456',
        profileIconUrl: 'https://i.pravatar.cc/150?img=14',
        thumbnailUrl:   'https://picsum.photos/id/239/400/600',
        videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
      },
      tableHeaders: ['Metric', 'Value'],
      tableRows: [
        ['Views',     '1,234,567'],
        ['Likes',     '45,678'],
        ['Comments',  '1,234'],
        ['Shares',    '3,210'],
        ['Downloads', '890'],
        ['Duration',  '00:58'],
        ['Quality',   'HD (720p)'],
      ],
    },
    quoted,
    {
      headerText: '\ud83e\uddea Inline Video + Table \u2014 Meta AI layout (V2)',
      footer: 'NEXORA-MD \u2022 contentItems (V2) + table (V2)',
    }
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'inline video + stats \u2713';
}

/**
 * Inline Image + Table — INLINE_IMAGE (type 3) + TABLE (type 4) submessages.
 * Combines an image preview with a stats table — ideal for search results,
 * weather cards, and download info with thumbnails.
 */
export async function testInlineImageWithTable(sock, jid, quoted) {
  const generated = generateInlineImageWithTableV2(
    {
      image: {
        imageUrl: {
          imagePreviewUrl: 'https://picsum.photos/id/237/400/300',
          imageHighResUrl: 'https://picsum.photos/id/237/800/600',
          sourceUrl: 'https://picsum.photos',
        },
        imageText: 'NEXORA-MD Test Image',
        alignment: 0,
        tapLinkUrl: 'https://github.com/boyde1317-byte/NEXORA-MD',
      },
      tableHeaders: [ 'Property', 'Value' ],
      tableRows: [
        [ 'Resolution',   '800x600'  ],
        [ 'Format',       'JPEG'     ],
        [ 'Source',       'picsum.photos' ],
        [ 'License',      'Unsplash'  ],
      ],
    },
    quoted,
    {
      headerText: '🧪 Inline Image + Table — search result card layout',
      footer: 'NEXORA-MD • inlineImage (type 3) + table (type 4)',
    }
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'inline image + table ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 Generators — new generators added in fork commit b9f5c84
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V2 List — base64-encoded list with no header row (list vs table distinction).
 */
export async function testV2List(sock, jid, quoted) {
  const generated = generateListContentV2(
    'NEXORA Plugins',
    [
      ['ping',    'general',  '✅'],
      ['about',   'general',  '✅'],
      ['sticker', 'media',    '✅'],
      ['daily',   'economy',  '✅'],
      ['eval',    'owner',    '🔒'],
      ['ai',      'ai',       '🧪'],
    ],
    quoted,
    { headerText: '🧪 V2 List Generator', footer: 'base64 unifiedResponse — no header row' },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 list ✓';
}

/**
 * V2 LaTeX — base64-encoded LaTeX expression.
 */
export async function testV2Latex(sock, jid, quoted) {
  const generated = generateLatexContentV2(quoted, {
    text: '🧪 V2 LaTeX Test — Euler identity:',
    expressions: [
      { latexExpression: 'e^{i\\pi} + 1 = 0', url: '', width: 180, height: 50 },
    ],
    headerText: 'LaTeX V2',
    footer: 'NEXORA-MD • base64 unifiedResponse',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 latex ✓';
}

/**
 * V2 Map — base64-encoded location card.
 */
export async function testV2Map(sock, jid, quoted) {
  const generated = generateMapContentV2(
    {
      centerLatitude: 5.6037,
      centerLongitude: -0.1870,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
      annotations: [
        { latitude: 5.6050, longitude: -0.1880, title: 'Cafe V2 One', body: 'Independence Ave' },
        { latitude: 5.6020, longitude: -0.1860, title: 'Cafe V2 Two', body: 'Ring Road Central' },
      ],
      showInfoList: true,
    },
    quoted,
    {
      headerText: '🧪 V2 Location Card — Accra',
      footer: 'NEXORA-MD • base64 unifiedResponse',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 map ✓';
}

/**
 * V2 Reel — base64-encoded video carousel.
 */
export async function testV2Reel(sock, jid, quoted) {
  const reels = [
    {
      title:          'V2 Reel Demo',
      profileIconUrl: 'https://i.pravatar.cc/150?img=20',
      thumbnailUrl:   'https://picsum.photos/id/240/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
    {
      title:          'V2 Reel Demo 2',
      profileIconUrl: 'https://i.pravatar.cc/150?img=21',
      thumbnailUrl:   'https://picsum.photos/id/241/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
  ];
  const generated = generateReelContentV2(reels, quoted, {
    headerText: '🧪 V2 Reel Content — Video Carousel',
    footer: 'NEXORA-MD • base64 unifiedResponse',
    contentType: 'CAROUSEL',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 reel ✓';
}

/**
 * V2 Reel + Stats — base64-encoded video carousel + stats table.
 */
export async function testV2ReelWithStats(sock, jid, quoted) {
  const generated = generateReelWithStatsV2(
    {
      reels: [
        {
          title:          'V2 TikTok Download',
          profileIconUrl: 'https://i.pravatar.cc/150?img=22',
          thumbnailUrl:   'https://picsum.photos/id/242/400/600',
          videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
        },
      ],
      tableHeaders: ['Metric', 'Value'],
      tableRows: [
        ['Views',     '2,345,678'],
        ['Likes',     '56,789'],
        ['Comments',  '2,345'],
        ['Shares',    '4,321'],
        ['Duration',  '01:12'],
        ['Quality',   'HD (1080p)'],
      ],
    },
    quoted,
    {
      headerText: '🧪 V2 Reel + Stats — TikTok Download',
      footer: 'NEXORA-MD • base64 unifiedResponse',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 reel + stats ✓';
}

/**
 * V2 Inline Image + Table — base64-encoded image preview + stats table.
 */
export async function testV2InlineImageWithTable(sock, jid, quoted) {
  const generated = generateInlineImageWithTableV2(
    {
      image: {
        imageUrl: {
          imagePreviewUrl: 'https://picsum.photos/id/237/400/300',
          imageHighResUrl: 'https://picsum.photos/id/237/800/600',
          sourceUrl: 'https://picsum.photos',
        },
        imageText: 'V2 Image Preview',
        alignment: 0,
        tapLinkUrl: 'https://github.com/boyde1317-byte/NEXORA-MD',
      },
      tableHeaders: ['Property', 'Value'],
      tableRows: [
        ['Resolution', '800x600'],
        ['Format',     'JPEG'],
        ['Source',     'picsum.photos'],
        ['License',    'Unsplash'],
      ],
    },
    quoted,
    {
      headerText: '🧪 V2 Inline Image + Table',
      footer: 'NEXORA-MD • base64 unifiedResponse',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 inline image + table ✓';
}

/**
 * V2 Inline Video + Stats — base64-encoded single video + stats table.
 */
export async function testV2InlineVideoWithStats(sock, jid, quoted) {
  const generated = generateInlineVideoWithStatsV2(
    {
      video: {
        title:          'V2 Inline Video',
        profileIconUrl: 'https://i.pravatar.cc/150?img=23',
        thumbnailUrl:   'https://picsum.photos/id/243/400/600',
        videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
      },
      tableHeaders: ['Metric', 'Value'],
      tableRows: [
        ['Views',     '3,456,789'],
        ['Likes',     '67,890'],
        ['Comments',  '3,456'],
        ['Shares',    '5,432'],
        ['Duration',  '01:30'],
        ['Quality',   'HD (1080p)'],
      ],
    },
    quoted,
    {
      headerText: '🧪 V2 Inline Video + Stats',
      footer: 'NEXORA-MD • base64 unifiedResponse',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 inline video + stats ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID_IMAGE + DYNAMIC generators (fork commit b9f5c84)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Grid Image — image gallery grid using gridImageMetadata (messageType 1).
 * Shows a main grid image + collection of thumbnails.
 */
export async function testV1GridImage(sock, jid, quoted) {
  const generated = generateGridImageContent(
    {
      gridImageUrl: {
        imagePreviewUrl: 'https://picsum.photos/id/237/400/400',
        imageHighResUrl: 'https://picsum.photos/id/237/800/800',
        sourceUrl: 'https://picsum.photos',
      },
      imageUrls: [
        { imagePreviewUrl: 'https://picsum.photos/id/238/200/200', imageHighResUrl: 'https://picsum.photos/id/238/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/239/200/200', imageHighResUrl: 'https://picsum.photos/id/239/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/240/200/200', imageHighResUrl: 'https://picsum.photos/id/240/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/241/200/200', imageHighResUrl: 'https://picsum.photos/id/241/400/400', sourceUrl: 'https://picsum.photos' },
      ],
    },
    quoted,
    {
      headerText: '🧪 V1 Grid Image — Photo Gallery',
      footer: 'NEXORA-MD • gridImageMetadata (type 1)',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 grid image ✓';
}

/**
 * V1 Dynamic — animated GIF/image using dynamicMetadata (messageType 6).
 */
export async function testV1Dynamic(sock, jid, quoted) {
  const generated = generateDynamicContent(
    { type: 'gif', url: 'https://media.giphy.com/media/3oEjI6SIIHBdIwqEoI/giphy.gif', loopCount: 3, version: 1 },
    quoted,
    {
      headerText: '🧪 V1 Dynamic — Animated GIF',
      footer: 'NEXORA-MD • dynamicMetadata (type 6, GIF)',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 dynamic ✓';
}

/**
 * V2 Grid Image — base64-encoded image gallery grid.
 */
export async function testV2GridImage(sock, jid, quoted) {
  const generated = generateGridImageContentV2(
    {
      gridImageUrl: {
        imagePreviewUrl: 'https://picsum.photos/id/237/400/400',
        imageHighResUrl: 'https://picsum.photos/id/237/800/800',
        sourceUrl: 'https://picsum.photos',
      },
      imageUrls: [
        { imagePreviewUrl: 'https://picsum.photos/id/238/200/200', imageHighResUrl: 'https://picsum.photos/id/238/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/239/200/200', imageHighResUrl: 'https://picsum.photos/id/239/400/400', sourceUrl: 'https://picsum.photos' },
      ],
    },
    quoted,
    {
      headerText: '🧪 V2 Grid Image — Photo Gallery',
      footer: 'NEXORA-MD • base64 unifiedResponse',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 grid image ✓';
}

/**
 * V2 Dynamic — base64-encoded animated content.
 */
export async function testV2Dynamic(sock, jid, quoted) {
  const generated = generateDynamicContentV2(
    { type: 'image', url: 'https://picsum.photos/id/300/400/300', loopCount: 0, version: 1 },
    quoted,
    {
      headerText: '🧪 V2 Dynamic — Animated Image',
      footer: 'NEXORA-MD • base64 unifiedResponse',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 dynamic ✓';
}

// Master test registry
// ─────────────────────────────────────────────────────────────────────────────

export const RICH_TESTS = [
  // V1 generators (submessage-based)
  { id: 'v1table',    label: '📊 V1 Table',           fn: testV1Table,         group: 'V1' },
  { id: 'v1list',     label: '📋 V1 List',            fn: testV1List,          group: 'V1' },
  { id: 'v1code',     label: '💻 V1 Code (JS)',       fn: testV1Code,          group: 'V1' },
  { id: 'v1python',   label: '🐍 V1 Code (Python)',    fn: testV1Python,        group: 'V1' },
  { id: 'v1latex',    label: '∫ V1 LaTeX',             fn: testV1Latex,        group: 'V1' },
  { id: 'v1raw',      label: '🔧 V1 Raw Submessages',  fn: testV1Raw,           group: 'V1' },
  // V2 generators (base64 unifiedResponse — Meta AI format)
  { id: 'v2table',    label: '📊 V2 Table',           fn: testV2Table,         group: 'V2' },
  { id: 'v2code',     label: '💻 V2 Code (JS)',       fn: testV2Code,          group: 'V2' },
  { id: 'v2go',       label: '🐹 V2 Code (Go)',        fn: testV2Go,            group: 'V2' },
  // Link content
  { id: 'v1link',     label: '🔗 V1 Link+Cit',        fn: testV1Link,          group: 'Links' },
  { id: 'v2link',     label: '🔍 V2 Search Cit',       fn: testV2Link,         group: 'Links' },
  // Tokenizer / parser unit tests
  { id: 'tokenizer',  label: '🔬 Tokenizer V2',       fn: testTokenizerV2,    group: 'Unit' },
  { id: 'tablemeta',  label: '🔬 Table Metadata V2',   fn: testTableMetadataV2, group: 'Unit' },
  // Capture & relay
  { id: "reel",       label: "🎬 Reel Content",       fn: testReelContent,     group: "Reels" },
  { id: "reelstats",  label: "🎬 Reel + Stats Table", fn: testReelWithStats,   group: "Reels" },
  { id: "map",        label: "📍 Location Card",     fn: testMapContent,      group: "Location" },
  { id: "inlinevid",  label: "🎬 Inline Video+Table", fn: testInlineVideoWithStats, group: "Location" },
  { id: "inlineimg",  label: "🖼️ Inline Image+Table", fn: testInlineImageWithTable, group: "Images" },
  { id: "capture",    label: "🔄 Capture & Relay",   fn: testCaptureRelay,    group: "Capture" },
  // V2 generators (new — fork commit b9f5c84)
  { id: 'v2list',     label: '📋 V2 List',            fn: testV2List,          group: 'V2' },
  { id: 'v2latex',    label: '∫ V2 LaTeX',            fn: testV2Latex,        group: 'V2' },
  { id: 'v2map',      label: '📍 V2 Location Card',   fn: testV2Map,           group: 'V2' },
  { id: 'v2reel',     label: '🎬 V2 Reel Carousel',  fn: testV2Reel,          group: 'V2' },
  { id: 'v2reelstats',label: '🎬 V2 Reel + Stats',    fn: testV2ReelWithStats,  group: 'V2' },
  { id: 'v2imgtable', label: '🖼️ V2 Image+Table',   fn: testV2InlineImageWithTable, group: 'V2' },
  { id: 'v2vidtable', label: '🎬 V2 Video+Table',    fn: testV2InlineVideoWithStats, group: 'V2' },
  // GRID_IMAGE + DYNAMIC (new — fork commit b9f5c84)
  { id: 'v1grid',     label: '🖼️ V1 Grid Image',    fn: testV1GridImage,     group: 'Grid/Dynamic' },
  { id: 'v1dyn',      label: '🎞️ V1 Dynamic GIF',    fn: testV1Dynamic,       group: 'Grid/Dynamic' },
  { id: 'v2grid',     label: '🖼️ V2 Grid Image',    fn: testV2GridImage,     group: 'Grid/Dynamic' },
  { id: 'v2dyn',      label: '🎞️ V2 Dynamic Image',  fn: testV2Dynamic,       group: 'Grid/Dynamic' },
];

export async function runRichTest(sock, jid, testId, quoted) {
  const test = RICH_TESTS.find(t => t.id === testId);
  if (!test) throw new Error('Unknown test: ' + testId);
  return test.fn(sock, jid, quoted);
}

export async function runAllRichTests(sock, jid, quoted) {
  const results = [];
  for (const test of RICH_TESTS) {
    try {
      const result = await test.fn(sock, jid, quoted);
      results.push({ id: test.id, label: test.label, ok: true, result });
    } catch (err) {
      results.push({ id: test.id, label: test.label, ok: false, result: err.message });
    }
    // Small delay between tests to avoid flooding
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}
