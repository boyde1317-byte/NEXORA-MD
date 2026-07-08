import { greetingBuilder } from '../greetingBuilder.js';
import { greetingConfig } from '../greetingConfig.js';

export const welcome2 = {
  id: 2,
  name: 'Document Card Greeting',

  async render({ sock, jid, userJid, variables, isWelcome }) {
    const textTemplate = isWelcome ? greetingConfig.getWelcomeText() : greetingConfig.getGoodbyeText();
    const caption = greetingBuilder.buildText(textTemplate, variables);

    const imageUrl = isWelcome ? greetingConfig.getWelcomeImage() : greetingConfig.getGoodbyeImage();
    const thumbnailPic = variables.profilePicUrl || imageUrl;

    const payload = {
      document: { url: imageUrl },
      mimetype: 'application/pdf',
      fileName: isWelcome ? '⚡_WELCOME_CARD.pdf' : '👋_GOODBYE_CARD.pdf',
      caption: caption,
      mentions: [userJid],
      contextInfo: {
        mentionedJid: [userJid],
        externalAdReply: {
          title: isWelcome ? '📁 SECURE DIGITAL ENTRY PASS' : '📁 GROUP EXIT DEPARTURE LOG',
          body: variables.groupName,
          mediaType: 1,
          thumbnailUrl: thumbnailPic,
          sourceUrl: 'https://ai.studio/build'
        }
      }
    };

    return payload;
  }
};

export default welcome2;
