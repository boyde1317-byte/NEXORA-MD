/**
 * test-payload-sanitizer.mjs — verify the inbound crash-payload gate.
 *
 * Replicas the actual payload shapes extracted from OchoVoid V2.0 GEN 1
 * (deob_ochovoid/deobfuscated.js builders at lines 512, 820, 855, 907,
 * 1014, 1086, 1110) and asserts filterCrashPayloads drops every one, while
 * normal WhatsApp traffic passes through untouched.
 *
 * Run: node scripts/test-payload-sanitizer.mjs
 */
import { filterCrashPayloads, inspectMessage, sanitizerStats } from '../src/core/payloadSanitizer.js';

let pass = 0, fail = 0;
function expectDrop(name, message, minReasons = 1) {
  const v = inspectMessage(message);
  if (v.crash && v.reasons.length >= minReasons) {
    pass++;
    console.log(`  DROP  ${name}  ->  ${v.reasons[0]}`);
  } else {
    fail++;
    console.error(`  MISS  ${name} — sanitizer did NOT flag it`);
  }
}
function expectClean(name, message) {
  const v = inspectMessage(message);
  if (!v.crash) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.error(`  FALSE POSITIVE  ${name} — flagged: ${v.reasons.join('; ')}`);
  }
}

const key = (id, jid = '6281234567890@s.whatsapp.net') => ({ remoteJid: jid, fromMe: false, id, participant: jid });
const msg = (content, id = 'TEST' + Math.random().toString(36).slice(2, 8).toUpperCase()) => ({ key: key(id), message: content, pushName: 't' });

// ── Real media metadata pulled verbatim from the OchoVoid builders ────────
const DOC = {
  url: 'https://mmg.whatsapp.net/v/t62.7119-24/583550661_2366231810527044_2211533771736792774_n.enc?ccb=11-4&oh=x',
  mimetype: 'application/pdf',
  fileSha256: '7rOXceVPuGvMTfHN7VXURYOQV2ZmzxQ4xZ6cLM2JNPA=',
  fileLength: 999999999,
  pageCount: 1000,
  mediaKey: 'oohdpzQ3uCjBvJWx+2VmRj4bWsCiTvrpUftezu27bs4=',
  fileName: 'Billy.pdf',
  fileEncSha256: 'IT6Goux9voqfI50TST8rtFY9iVmxZenRz55JXZpAR2g=',
  directPath: '/v/t62.7119-24/583550661_2366231810527044_2211533771736792774_n.enc',
  mediaKeyTimestamp: '1779839963',
  thumbnailDirectPath: '/v/t62.36145-24/705860036_1320514133375133_5228808273876536402_n.enc',
  thumbnailSha256: 'xK2z7ScS2wSQDxLVfdZ5e1BpIe+GsTv8KaVGAfufqjY=',
  thumbnailEncSha256: '2N98oiJb8xii+D/KYAuHRq7Mg/8OIHFXNZQ5py4g9fM=',
  jpegThumbnail: null,
  contextInfo: {},
  thumbnailHeight: 999,
  thumbnailWidth: 999,
  scansSidecar: 'pDwqT9IYsTrggiHldJAKrJuoOn7Knn7f2LjPxVpwnhWHFTT0b83iwQ==',
  scanLengths: [10000000000000000000, 10000000000000000000, 10000000000000000000, 10000000000000000000],
  midQualityFileSha256: 'zBHV83UQlILLcv3tAwnwaSk4FqEkZho3YKidG64duT0='
};
const IMAGE_100TB = {
  url: 'https://mmg.whatsapp.net/v/t62.7118-24/613381757_981708741479682_6415817420190586389_n.enc?ccb=11-4&oh=x',
  mimetype: 'image/jpeg',
  caption: 'noname',
  fileSha256: 'umQsdlmP4w9dL35/1yb2Wy5x6ypLvSXUy3r7veQ/rNU=',
  fileLength: '109951162777600',
  height: -9999,
  width: 9999,
  mediaKey: 'pbSAJfuBxe4QBnJO34YFyM1EX4ZABBJsmW6rhvT+5+I=',
  fileEncSha256: '8frUJ7Tt5d1EXOSWiP/9CBdN4fP2gPV6WPE0sN/IaF4=',
  directPath: '/v/t62.7118-24/613381757_981708741479682_6415817420190586389_n.enc',
  mediaKeyTimestamp: '1774107894',
  jpegThumbnail: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z/8=',
  viewOnce: true,
  scansSidecar: 'pDwqT9IYsTrggiHldJAKrJuoOn7Knn7f2LjPxVpwnhWHFTT0b83iwQ==',
  scanLengths: [10000000000000000000, 10000000000000000000, 10000000000000000000, 10000000000000000000],
  midQualityFileSha256: 'zBHV83UQlILLcv3tAwnwaSk4FqEkZho3YKidG64duT0='
};

console.log('\n── Crash payloads (replicas of the 7 OchoVoid builders) ──');

// Builder 1 (_0x38787e): doc header + 500k native-flow buttons
expectDrop('blank-hard doc header + 500k buttons', msg({
  groupStatusMessageV2: { message: { interactiveMessage: {
    header: { documentMessage: DOC },
    body: { text: '¡!¿?' },
    nativeFlowMessage: { buttons: Array.from({ length: 500000 }, () => ({})) }
  } } }
}));

// Builder 1, second variant: 100 TB image header
expectDrop('blank-hard 100TB image header', msg({
  groupStatusMessageV2: { message: { interactiveMessage: {
    header: { imageMessage: IMAGE_100TB },
    body: { text: 'the king' },
    nativeFlowMessage: { buttons: Array.from({ length: 500000 }, () => ({})) }
  } } }
}));

// Builder 1, third variant: insane location + NUL-filled buttons string
expectDrop('blank-hard location + NUL buttons string', msg({
  groupStatusMessageV2: { message: { interactiveMessage: {
    locationMessage: { degreesLatitude: 9999999999, degreesLongitude: 9999999999 },
    body: { text: '¡!' },
    nativeFlowMessage: { buttons: '\0'.repeat(500000) }
  } } }
}));

// Builder 2 (_0x1e1f38): "[];" body + 500k buttons
expectDrop('delay variant [];/500k buttons', msg({
  groupStatusMessageV2: { message: { interactiveMessage: {
    body: { text: '[];' },
    nativeFlowMessage: { buttons: Array.from({ length: 500000 }, () => ({})) }
  } } }
}));

// Builder 3 (_0x362a18): "JUST END NOW" + 10k zero-width spaces
expectDrop('force variant zero-width flood', msg({
  conversation: 'JUST END NOW' + '\u200b'.repeat(10000)
}));

// Builder 4 (_0x2c8522): malformed Flows — 20k response buttons + NUL order fields
expectDrop('flows order_status NUL flood', msg({
  interactiveMessage: {
    body: { text: 'x' },
    nativeFlowMessage: {
      buttons: [{ name: 'order_status', buttonParamsJson: JSON.stringify({
        order_id: '\0'.repeat(100000),
        order_title: '\0'.repeat(70000),
        status: 'PROCESSING',
        token: 'sgL4_dxscbfayun',
        flow_message_version: '1'
      }) }],
      nativeFlowResponseMessage: {
        buttons: Array.from({ length: 20002 }, () => ({})),
        messageVersion: 1
      }
    }
  }
}));

// Builder 5 (_0x33fe61): huge screen TextInput flood in Flows params
expectDrop('flows screen_0_TextInput_0 50k flood', msg({
  interactiveMessage: {
    nativeFlowMessage: { buttons: [{ name: 'review_and_pay', buttonParamsJson: JSON.stringify({
      screen_2_OptIn_1: true,
      screen_1_TextInput_2: '\0'.repeat(50000),
      flow_token: 'AQAAAAACS5FpgQ_cAAAAAE0QI3s.'
    }) }] }
  }
}));

// Sub-threshold button arrays that would still stress a renderer (20k)
expectDrop('20k empty buttons (sub-500k variant)', msg({
  interactiveMessage: { nativeFlowMessage: { buttons: Array.from({ length: 20002 }, () => ({})) } }
}));

// Wrapped in viewOnce + ephemeral like real bug deliveries
expectDrop('viewOnce-wrapped 500k buttons', msg({
  viewOnceMessage: { message: {
    ephemeralMessage: { message: {
      interactiveMessage: { nativeFlowMessage: { buttons: Array.from({ length: 500000 }, () => ({})) } }
    } }
  } }
}));

console.log('\n── Benign traffic (must pass untouched) ──');
expectClean('plain text', msg({ conversation: 'hello bot' }));
expectClean('extended text', msg({ extendedTextMessage: { text: 'reply to bot', matchedText: '' } }));
expectClean('normal image', msg({ imageMessage: {
  url: 'https://mmg.whatsapp.net/v/t62.7118-24/normal_n.enc',
  mimetype: 'image/jpeg', caption: 'photo', fileSha256: 'abc=',
  fileLength: 182345, height: 1080, width: 810, mediaKey: 'key=',
  fileEncSha256: 'def=', directPath: '/v/t62.7118-24/normal_n.enc',
  mediaKeyTimestamp: '1774107894', jpegThumbnail: 'iVBORw0KGgo='
} }));
expectClean('normal document', msg({ documentMessage: {
  url: 'https://mmg.whatsapp.net/v/t62.7119-24/doc.pdf.enc',
  mimetype: 'application/pdf', fileLength: 512000, pageCount: 3,
  fileName: 'report.pdf', fileSha256: 'abc=', fileEncSha256: 'def=',
  directPath: '/v/t62.7119-24/doc.pdf.enc', mediaKey: 'key=',
  mediaKeyTimestamp: '1779839963', scanLengths: [12345, 6789]
} }));
expectClean('normal interactive buttons', msg({ interactiveMessage: {
  body: { text: 'Choose an option' },
  nativeFlowMessage: { buttons: [
    { name: 'quick_reply', buttonParamsJson: '{"id":"opt1","text":"One"}' },
    { name: 'quick_reply', buttonParamsJson: '{"id":"opt2","text":"Two"}' },
    { name: 'cta_url', buttonParamsJson: '{"display_text":"Open","url":"https://example.com"}' }
  ] }
} }));
expectClean('real location', msg({ locationMessage: { degreesLatitude: -6.2088, degreesLongitude: 106.8456 } }));
expectClean('viewOnce-wrapped normal image', msg({
  viewOnceMessage: { message: { imageMessage: { ...{
    url: 'https://mmg.whatsapp.net/v/t62.7118-24/vo.enc', mimetype: 'image/jpeg',
    caption: 'vo', fileLength: 95000, height: 720, width: 1280,
    mediaKey: 'key=', fileSha256: 'a=', fileEncSha256: 'b=', directPath: '/v/x'
  } } } }
}));
expectClean('status@broadcast receipt-style update', msg({
  conversation: 'status update text',
  messageContextInfo: { messageSecret: 'c29tZXNlY3JldA==' }
}, 'STATUSID1'));

console.log('\n── Batch filter + stats ──');
sanitizerStats.dropped = 0;
const batch = [
  msg({ conversation: 'normal one' }, 'GOOD1'),
  msg({ groupStatusMessageV2: { message: { interactiveMessage: { nativeFlowMessage: { buttons: Array.from({ length: 500000 }, () => ({})) } } } } }, 'EVIL1'),
  msg({ conversation: 'normal two' }, 'GOOD2'),
];
const kept = filterCrashPayloads(batch, 'test');
console.log(`  batch: ${batch.length} in -> ${kept.length} kept, stats.dropped=${sanitizerStats.dropped}`);
if (kept.length === 2 && kept[0].key.id === 'GOOD1' && kept[1].key.id === 'GOOD2' && sanitizerStats.dropped === 1) {
  pass++;
  console.log('  PASS  batch filter preserves order and drops only the weapon');
} else {
  fail++;
  console.error('  FAIL  batch filter output wrong');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
