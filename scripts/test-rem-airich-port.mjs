import assert from 'node:assert/strict';
import { AIRich } from '../src/lib/NIXCODE.js';

const sock = {
  user: { id: 'bot@s.whatsapp.net' },
  waUploadToServer: async () => ({ url: 'https://mmg.whatsapp.net/test' }),
  relayMessage: async () => {},
};

const card = new AIRich(sock)
  .setTitle('Rem Airich compatibility')
  .addText('English text')
  .addEntity({ title: 'Pinterest', subtitle: 'Search results', id: '12345' })
  .addMultiWidgets([{ title: 'Actions', buttons: [{ label: 'Open', id: '.open' }] }])
  .addFooterLinks([{ text: 'Pinterest', url: 'https://www.pinterest.com' }])
  .addHtml('<div>safe test payload</div>', { trustedSources: ['pinterest.com'] })
  .setFooter('NEXORA Airich port');

const payload = card.build({ quoted: { key: { id: 'quoted-id', remoteJid: 'user@s.whatsapp.net' }, message: { conversation: 'test' } } });
const encoded = payload.botForwardedMessage.message.richResponseMessage.unifiedResponse.data;
const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
const types = decoded.sections.flatMap((section) => {
  const view = section.view_model || {};
  return [view.primitive, ...(view.primitives || [])].filter(Boolean).map((item) => item.__typename);
});
assert.ok(types.includes('GenAICompactEntityPrimitive'));
assert.ok(types.includes('GenAI3PExtWidgetPrimitive'));
assert.ok(types.includes('GenAIFooterActionPrimitive'));
assert.ok(types.includes('GenAIaeacdsnwHtmlPrimitive'));
assert.equal(payload.botForwardedMessage.message.richResponseMessage.contextInfo.quotedMessage.conversation, 'test');
console.log('Rem Airich port tests passed.');
