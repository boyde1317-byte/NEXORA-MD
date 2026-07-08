import { downloadMediaMessage } from 'baileys';
import { config } from '../../config/index.js';
import { messageFormatter } from '../ui/messageFormatter.js';

export async function serialize(m, sock) {
  if (!m) return m;

  // Clone or copy key
  const message = { ...m };
  
  if (message.key) {
    message.id = message.key.id;
    message.from = message.key.remoteJid;
    message.fromMe = message.key.fromMe;
    message.isGroup = message.from.endsWith('@g.us');
    
    // Normalize sender JID (strip connection suffix if needed)
    const rawSender = message.key.participant || message.key.remoteJid;
    message.sender = rawSender.includes(':') 
      ? rawSender.split(':')[0] + '@s.whatsapp.net' 
      : rawSender;
      
    message.senderNumber = message.sender.split('@')[0];
    message.isOwner = config.owner.includes(message.senderNumber);
  }

  if (message.message) {
    // Get actual message type
    const types = Object.keys(message.message);
    // Ignore messageContextInfo, senderKeyDistributionMessage, protocols
    const type = types.find(t => 
      t !== 'messageContextInfo' && 
      t !== 'senderKeyDistributionMessage' && 
      t !== 'protocolMessage'
    ) || types[0];

    message.type = type;
    const msgContent = message.message[type];
    message.msg = msgContent;

    // Extract raw text content
    message.body = '';
    if (type === 'conversation') {
      message.body = msgContent;
    } else if (type === 'extendedTextMessage') {
      message.body = msgContent.text || '';
    } else if (type === 'imageMessage' || type === 'videoMessage') {
      message.body = msgContent.caption || '';
    } else if (type === 'buttonsResponseMessage') {
      message.body = msgContent.selectedButtonId || '';
    } else if (type === 'listResponseMessage') {
      message.body = msgContent.singleSelectReply?.selectedRowId || '';
    } else if (type === 'templateButtonReplyMessage') {
      message.body = msgContent.selectedId || '';
    } else if (type === 'interactiveResponseMessage') {
      const responseData = JSON.parse(msgContent.nativeFlowResponseMessage?.paramsJson || '{}');
      message.body = responseData.id || '';
    }

    // Quoted Message parsing
    const contextInfo = msgContent?.contextInfo;
    if (contextInfo && contextInfo.quotedMessage) {
      const qMessage = contextInfo.quotedMessage;
      const qTypes = Object.keys(qMessage);
      const qType = qTypes.find(t => t !== 'messageContextInfo') || qTypes[0];
      const qContent = qMessage[qType];

      // Normalize quoted sender
      const rawQuotedSender = contextInfo.participant;
      const quotedSender = rawQuotedSender.includes(':')
        ? rawQuotedSender.split(':')[0] + '@s.whatsapp.net'
        : rawQuotedSender;

      let quotedBody = '';
      if (qType === 'conversation') quotedBody = qContent;
      else if (qType === 'extendedTextMessage') quotedBody = qContent.text || '';
      else if (qType === 'imageMessage' || qType === 'videoMessage') quotedBody = qContent.caption || '';

      message.quoted = {
        id: contextInfo.stanzaId,
        sender: quotedSender,
        senderNumber: quotedSender.split('@')[0],
        isOwner: config.owner.includes(quotedSender.split('@')[0]),
        type: qType,
        message: qMessage,
        msg: qContent,
        body: quotedBody,
        // Helper to download quoted message media
        download: async () => {
          const fakeMessage = {
            key: {
              remoteJid: message.from,
              fromMe: quotedSender === (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : ''),
              id: contextInfo.stanzaId,
              participant: contextInfo.participant
            },
            message: qMessage
          };
          return await downloadMediaMessage(fakeMessage, 'buffer', {});
        }
      };
    }
  }

  // Group helpers
  message.getGroupMetadata = async () => {
    if (!message.isGroup) return null;
    try {
      return await sock.groupMetadata(message.from);
    } catch (e) {
      console.error(`Failed to fetch group metadata for ${message.from}:`, e);
      return null;
    }
  };

  message.isAdmin = async () => {
    if (!message.isGroup) return false;
    const metadata = await message.getGroupMetadata();
    if (!metadata) return false;
    const participant = metadata.participants.find(p => {
      const pJid = p.id.includes(':') ? p.id.split(':')[0] + '@s.whatsapp.net' : p.id;
      return pJid === message.sender;
    });
    return !!(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
  };

  message.isBotAdmin = async () => {
    if (!message.isGroup) return false;
    const metadata = await message.getGroupMetadata();
    if (!metadata) return false;
    const botJid = sock.user.id.includes(':')
      ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
      : sock.user.id;
    const participant = metadata.participants.find(p => {
      const pJid = p.id.includes(':') ? p.id.split(':')[0] + '@s.whatsapp.net' : p.id;
      return pJid === botJid;
    });
    return !!(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
  };

  // Reply helper with decorated message modernization formatters
  const replyFn = async (text, options = {}) => {
    return await sock.sendMessage(
      message.from, 
      { text }, 
      { quoted: m, ...options }
    );
  };

  replyFn.success = async (text, options = {}) => {
    return await replyFn(messageFormatter.success(text), options);
  };

  replyFn.error = async (text, options = {}) => {
    return await replyFn(messageFormatter.error(text), options);
  };

  replyFn.warn = async (text, options = {}) => {
    return await replyFn(messageFormatter.warn(text), options);
  };

  replyFn.info = async (text, title = 'INFO', options = {}) => {
    return await replyFn(messageFormatter.info(text, title), options);
  };

  replyFn.loading = async (text = 'Downloading media...', options = {}) => {
    return await replyFn(messageFormatter.loading(text), options);
  };

  message.reply = replyFn;

  // React helper
  message.react = async (emoji) => {
    return await sock.sendMessage(message.from, {
      react: {
        text: emoji,
        key: message.key
      }
    });
  };

  // Delete helper
  message.delete = async () => {
    return await sock.sendMessage(message.from, {
      delete: message.key
    });
  };

  // Edit helper
  message.edit = async (newText) => {
    return await sock.sendMessage(message.from, {
      text: newText,
      edit: message.key
    });
  };

  // Download current media helper
  message.download = async () => {
    if (!message.message) return null;
    return await downloadMediaMessage(m, 'buffer', {});
  };

  return message;
}
