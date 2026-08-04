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
  generateMessageIDV2,
  generateWAMessageFromContent,
  proto,
} from 'baileys';

// ── V1 + V2 generators (imported from the fork's rich-message-utils.js) ─────
import {
  buildRichContextInfo,
  buildBotForwardedMessage,
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
      text: '🧪 *Capture & Relay Test*\n\n❌ captureUnifiedResponse returned null — no unifiedResponse data in V1 submessage format.\n\n_Note: V1 generators don\'t include unifiedResponse.data — only V2 generators do._',
    }, { quoted });
    return 'capture relay — V1 has no unifiedResponse (expected)';
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
      profileIconUrl: 'https://github.com/boyde1317-byte.png',
      thumbnailUrl:   'https://cdn.jsdelivr.net/gh/whatsapp/docs@main/static/img/logo.png',
      videoUrl:       'https://example.com/demo.mp4',
    },
    {
      title:          'Interactive Menu Showcase',
      profileIconUrl: 'https://github.com/boyde1317-byte.png',
      thumbnailUrl:   'https://cdn.jsdelivr.net/gh/whatsapp/docs@main/static/img/logo.png',
      videoUrl:       'https://example.com/menu.mp4',
    },
  ];
  const generated = generateReelContent(reels, quoted, {
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
        profileIconUrl: 'https://github.com/boyde1317-byte.png',
        thumbnailUrl:   'https://cdn.jsdelivr.net/gh/whatsapp/docs@main/static/img/logo.png',
        videoUrl:       'https://v16-webapp.tiktok.com/example.mp4',
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
  const generated = generateReelWithStats(params, quoted, {
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
  { id: "capture",    label: "🔄 Capture & Relay",   fn: testCaptureRelay,    group: "Capture" },
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
