/**
 * @file src/plugins/owner/connection.js
 *
 * .connection — Shows WhatsApp connection health, state history, message
 * metrics, and reconnect diagnostics. Wraps the unused
 * src/core/connectionMonitor.js module as an owner-only diagnostic command.
 *
 * Uses the connectionMonitor singleton which tracks:
 *   - Connection state (connected/disconnected/reconnecting/error)
 *   - Uptime (accumulated across reconnects)
 *   - Message metrics (received/sent/commands/errors)
 *   - Reconnect history with durations and reasons
 *   - Heartbeat health (last incoming/outgoing age, stall detection)
 */

import { connectionMonitor } from '../../core/connectionMonitor.js';
import { formatUptime } from '../../lib/utils.js';

export default {
  name:        'connection',
  aliases:     ['health', 'conn'],
  category:    'owner',
  description: 'Shows WhatsApp connection health, metrics, and reconnect diagnostics.',
  cooldown:    3000,
  permissions:  { owner: true },

  execute: async ({ sock, m }) => {
    const health   = connectionMonitor.getHealth();
    const metrics   = connectionMonitor.getMetrics();
    const stats     = connectionMonitor.getReconnectStats();
    const history   = connectionMonitor.getStateHistory();
    const reconnects = connectionMonitor.getReconnectHistory();

    // ── State indicator ───────────────────────────────────────────────────
    const stateEmoji = {
      connected:    '\u{1F7E2}',
      connecting:   '\u{1F7E1}',
      reconnecting: '\u{1F7E1}',
      disconnected: '\u{1F534}',
      error:        '\u{1F534}',
      logged_out:   '\u{1F6AB}',
    };
    const stateIcon = stateEmoji[health.state] || '\u2754';

    // ── Uptime ────────────────────────────────────────────────────────────
    const uptimeStr = health.uptime > 0 ? formatUptime(health.uptime / 1000) : 'N/A';

    // ── Last activity ─────────────────────────────────────────────────────
    const fmtAge = (ms) => {
      if (ms === null || ms === undefined) return 'N/A';
      if (ms < 60000)   return `${Math.round(ms / 1000)}s ago`;
      if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
      return `${Math.round(ms / 3600000)}h ago`;
    };

    // ── Reconnect history (last 5) ─────────────────────────────────────────
    let reconnectText = '';
    const recentReconnects = reconnects.slice(-5).reverse();
    if (recentReconnects.length > 0) {
      reconnectText = '\n\n\u2500\u2500 Reconnect History \u2500\u2500\n';
      for (const r of recentReconnects) {
        const time = new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dur  = r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '...';
        const icon = r.status === 'success' ? '\u2705' : r.status === 'failed' ? '\u274C' : '\u23F3';
        reconnectText += `${icon} #${r.attempt} \u2502 ${time} \u2502 ${dur} \u2502 ${r.reason}\n`;
      }
    }

    // ── State history (last 5) ─────────────────────────────────────────────
    let stateHistoryText = '';
    const recentStates = history.slice(-5).reverse();
    if (recentStates.length > 0) {
      stateHistoryText = '\n\u2500\u2500 State Transitions \u2500\u2500\n';
      for (const s of recentStates) {
        const time = new Date(s.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        stateHistoryText += `${stateEmoji[s.state] || '\u2754'} ${s.from} \u2192 ${s.to} \u2502 ${time}${s.reason ? ` \u2502 ${s.reason}` : ''}\n`;
      }
    }

    // ── Build output ───────────────────────────────────────────────────────
    const output =
      `\u{1F4E1} *Connection Health*\n\n` +
      `*State:* ${stateIcon} ${health.state || 'unknown'}\n` +
      `*Uptime:* ${uptimeStr}\n` +
      `*Latency:* ${connectionMonitor.heartbeat.getLatency()}ms\n\n` +
      `\u2500\u2500 Message Metrics \u2500\u2500\n` +
      `\u{1F4E5} Received:    ${metrics.messagesReceived}\n` +
      `\u{1F4E4} Sent:        ${metrics.messagesSent}\n` +
      `\u26A1 Commands:    ${metrics.commandsExecuted}\n` +
      `\u274C Errors:      ${metrics.errorsCaught}\n` +
      `\u{1F501} Reconnects:  ${metrics.reconnects}\n` +
      `\u{1F465} Group Events: ${metrics.groupEvents}\n\n` +
      `\u2500\u2500 Last Activity \u2500\u2500\n` +
      `\u{1F4E5} Last In:  ${fmtAge(health.lastIncomingAge)}\n` +
      `\u{1F4E4} Last Out: ${fmtAge(health.lastOutgoingAge)}\n` +
      `\u{1F4CA} Total Msg: ${health.totalMessages}\n` +
      `\u274C Total Err: ${health.totalErrors}\n` +
      reconnectText +
      stateHistoryText;

    await sock.sendMessage(m.from, { text: output }, { quoted: m });
  },
};
