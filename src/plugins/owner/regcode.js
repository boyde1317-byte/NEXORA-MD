/**
 * regcode.js — Request a WhatsApp registration code for a phone number.
 * Owner-only. Sends a real SMS/voice code to the number and stores the
 * registration options in the bot's auth credentials, so `.register`
 * can complete it afterwards. This is first-time setup tooling, not a
 * routine command: requesting codes for numbers you do not control
 * spams their owner with verification SMS.
 *
 * Ghana example: .regcode 233 241234567 620 01 sms
 * (cc, national number, mobile country code, mobile network code, method)
 */
import { hasSocketMethod } from '../../lib/socketTargets.js';

const METHODS = ['sms', 'voice', 'flash', 'wa_old'];

export default {
  name: 'regcode',
  aliases: ['requestregcode', 'regrequest'],
  category: 'owner',
  description: 'Request a registration code. Usage: .regcode <cc> <number> <mcc> [mnc] [sms|voice]',
  cooldown: 60000,
  permissions: { owner: true },
  execute: async ({ sock, m, args }) => {
    if (!hasSocketMethod(sock, 'requestRegistrationCode')) {
      return await m.reply.error('This socket does not expose requestRegistrationCode — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const cc = String(args[0] || '').replace(/[^0-9]/g, '');
    const national = String(args[1] || '').replace(/[^0-9]/g, '');
    const mcc = String(args[2] || '').replace(/[^0-9]/g, '');
    if (!cc || !national || !/^\d{3}$/.test(mcc)) {
      return await m.reply.error('Usage: `.regcode <cc> <number> <mcc> [mnc] [sms|voice]`\n\nExample (Ghana): `.regcode 233 241234567 620 01 sms`\n\nThis sends a real verification code to that number. Only use it for a number you control.');
    }
    let mnc;
    let method = 'sms';
    for (const arg of args.slice(3)) {
      const v = String(arg).toLowerCase();
      if (METHODS.includes(v)) method = v;
      else if (/^\d+$/.test(v)) mnc = v;
    }
    try {
      const result = await sock.requestRegistrationCode({
        phoneNumberCountryCode: cc,
        phoneNumberNationalNumber: national,
        phoneNumberMobileCountryCode: mcc,
        ...(mnc ? { phoneNumberMobileNetworkCode: mnc } : {}),
        method,
      });
      const status = result?.status || 'unknown';
      return await m.reply(`📩 Registration code requested for +${cc}${national} via ${method}.\n▸ Status: ${status}\n\nThe options are now stored in the bot's auth credentials. Complete it with \`.register <code> confirm\``);
    } catch (err) {
      console.error('[regcode]', err?.message || err);
      const detail = err?.reason || err?.message || err;
      return await m.reply.error(`Registration code request failed: ${detail}`);
    }
  },
};
