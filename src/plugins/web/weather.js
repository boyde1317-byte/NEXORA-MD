/**
 * weather.js — Current weather for a location.
 *
 * Upgraded from copyResultCard → richTableCard for structured weather data
 * display, with mixedCard follow-up for map and refresh actions.
 */
import { Providers } from '../../lib/webClient.js';
import { richTableCard, mixedCard } from '../../lib/interactiveKit.js';

export default {
  name: 'weather',
  category: 'web',
  description: 'Get the current weather for a location.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p        = prefix || '.';
    const location = args.join(' ');
    if (!location) {
      return await m.reply.info(`Usage: \`${p}weather <city>\``, 'WEATHER');
    }

    try {
      const data = await Providers.weather(location);
      if (!data.current_condition?.[0]) {
        throw new Error('Location not found or API error.');
      }

      const current = data.current_condition[0];
      const reqInfo = data.nearest_area?.[0];
      const locName = reqInfo
        ? `${reqInfo.areaName[0].value}, ${reqInfo.country[0].value}`
        : location;

      // ── Tier 1: richTableCard + mixedCard ────────────────────────────
      try {
        await richTableCard(sock, m.from, {
          title:   `🌤️ WEATHER — ${locName.toUpperCase()}`,
          headers: ['Field', 'Value'],
          rows: [
            ['Condition',   current.weatherDesc[0].value],
            ['Temp',        `${current.temp_C}°C / ${current.temp_F}°F`],
            ['Feels Like',  `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`],
            ['Humidity',    `${current.humidity}%`],
            ['Wind',        `${current.windspeedKmph} km/h ${current.winddir16Point}`],
            ['Visibility',  `${current.visibility} km`],
            ['UV Index',    current.uvIndex ?? 'N/A'],
            ['Cloud Cover', `${current.cloudcover}%`],
            ['Pressure',    `${current.pressure} hPa`],
          ].filter(([, v]) => v !== 'N/A'),
          footer: 'Powered by wttr.in • NEXORA Web',
        }, { quoted: m });

        const mapsUrl = reqInfo
          ? `https://maps.google.com/?q=${encodeURIComponent(locName)}`
          : `https://maps.google.com/?q=${encodeURIComponent(location)}`;

        return await mixedCard(sock, m.from, {
          text:   `📍 *${locName}*`,
          footer: `${current.weatherDesc[0].value} • ${current.temp_C}°C`,
        }, [
          { kind: 'url',    label: '🗺️ View on Maps',      url:   mapsUrl },
          { kind: 'action', label: '🔄 Refresh Weather',   cmd:   `${p}weather ${location}` },
          { kind: 'action', label: '🕐 Check Time',        cmd:   `${p}time ${location}` },
        ], { quoted: m });
      } catch (err) {
        console.warn('[weather] Tier 1 (richTableCard) failed, plain-text fallback:', err.message);
      }

      // ── Tier 2: plain text fallback ───────────────────────────────────
      await m.reply(
        `🌤️ *WEATHER: ${locName}*\n\n` +
        `*Condition:* ${current.weatherDesc[0].value}\n` +
        `*Temperature:* ${current.temp_C}°C (${current.temp_F}°F)\n` +
        `*Feels Like:* ${current.FeelsLikeC}°C\n` +
        `*Humidity:* ${current.humidity}%\n` +
        `*Wind:* ${current.windspeedKmph} km/h ${current.winddir16Point}\n` +
        `*Visibility:* ${current.visibility} km`
      );
    } catch (err) {
      await m.reply.error(`Failed to fetch weather: ${err.message}`);
    }
  }
};
