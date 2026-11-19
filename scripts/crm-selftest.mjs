// Self-test for src/lib/crmStore.js. Run from an empty directory:
//   mkdir -p /tmp/crmtest && cd /tmp/crmtest && node <repo>/scripts/crm-selftest.mjs
const root = new URL('..', import.meta.url).pathname;
const fs = await import('node:fs');
fs.mkdirSync('/tmp/crmtest/data', { recursive: true });
const { proto } = await import('baileys');
const crm = await import(`${root}/src/lib/crmStore.js`);
const crypto = await import('node:crypto');

crm.initCrmStore();

// 1. message round trip
const key = { id: 'TESTMSG1', remoteJid: '233533416608@s.whatsapp.net', fromMe: true };
crm.saveMessage({ key, message: { conversation: 'hello archive' }, messageTimestamp: 1700000000 }, key.remoteJid);
const back = crm.loadMessage('TESTMSG1', key.remoteJid);
const decoded = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(back), { bytes: String, defaults: false });
console.log('message roundtrip:', decoded.message?.conversation === 'hello archive');

// 2. node round trip with a Buffer inside
crm.saveNode('TESTMSG1', key.remoteJid, { tag: 'message', attrs: { id: 'TESTMSG1' }, content: [{ tag: 'biz', attrs: {}, content: [], extra: Buffer.from('x') }] });
const node = crm.loadNode('TESTMSG1', key.remoteJid);
console.log('node roundtrip:', node?.tag === 'message' && Buffer.isBuffer(node.content[0].extra));

// 3. recentIds
console.log('recentIds:', JSON.stringify(crm.recentIds(key.remoteJid, 3)));

// 4. secret edit recovery: build a real MESSAGE_EDIT for TESTMSG1
const secret = crypto.randomBytes(32);
const targetObj = { key: { id: 'TESTMSG1', remoteJid: key.remoteJid }, message: { conversation: 'hello archive', messageContextInfo: { messageSecret: secret.toString('base64') } } };
crm.saveMessage(targetObj, key.remoteJid);

const plaintext = proto.Message.encode(proto.Message.fromObject({ conversation: 'edited text' })).finish();
const info = Buffer.concat([Buffer.from('TESTMSG1', 'utf8'), Buffer.from(key.remoteJid, 'utf8'), Buffer.from(key.remoteJid, 'utf8'), Buffer.from('Message Edit', 'utf8')]);
const derived = Buffer.from(crypto.hkdfSync('sha256', secret, Buffer.alloc(0), info, 32));
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', derived, iv);
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const payload = Buffer.concat([ct, cipher.getAuthTag()]);

const envelope = {
  key: { id: 'EDITMSG1', remoteJid: key.remoteJid },
  message: { secretEncryptedMessage: {
    targetMessageKey: { id: 'TESTMSG1', remoteJid: key.remoteJid },
    secretEncType: 2, // MESSAGE_EDIT (1 is EVENT_EDIT)
    encPayload: payload.toString('base64'),
    encIv: iv.toString('base64'),
  } },
};
const recovered = crm.decryptSecretEnvelope(envelope);
console.log('secret edit recovered:', recovered.message?.conversation === 'edited text', '| from:', recovered.__decryptedFrom);

// 5. plain messages pass through untouched
const passthrough = crm.decryptSecretEnvelope({ key: { id: 'x' }, message: { conversation: 'plain' } });
console.log('passthrough untouched:', passthrough.message.conversation === 'plain' && !passthrough.__decryptedFrom);

// 6. bind patches a socket once
const sent = [];
const sock = { ev: { on() {} }, ws: { on() {} }, user: { id: 'x' },
  sendMessage: async (jid, content) => { sent.push(content); return { key: { id: 'OUT1', remoteJid: jid }, message: content }; } };
crm.bindCrmStore(sock);
crm.bindCrmStore(sock);
await sock.sendMessage(key.remoteJid, { conversation: 'outgoing' });
console.log('send archived:', !!crm.loadMessage('OUT1', key.remoteJid), '| patched once:', sock.sendMessage.__crmPatched === true);
