/**
 * weather.js — Weather lookup for any city.
 *
 * Uses Open-Meteo's free API (no key required). Provides current conditions
 * + a 3-day forecast in a clean card format.
 *
 * Usage:
 *   .weather <city>           — current weather
 *   .weather <city> forecast   — 3-day forecast
 */
import { buildEnrichedContextInfo } from '../../lib/enrichContext.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard, actionCard, mixedCard } from '../../lib/interactiveKit.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

const WEATHER_CODES = {
  0: '☀️ Clear sky', 1: '🌤️ Mainly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast',
  45: '🌫️ Fog', 48: '🌫️ Rime fog', 51: '🌦️ Light drizzle', 53: '🌦️ Drizzle',
  55: '🌧️ Heavy drizzle', 56: '🌧️ Freezing drizzle', 57: '🌧️ Freezing drizzle',
  61: '🌧️ Light rain', 63: '🌧️ Rain', 65: '🌧️ Heavy rain',
  66: '🌧️ Freezing rain', 67: '🌧️ Freezing rain', 71: '🌨️ Light snow',
  73: '🌨️ Snow', 75: '❄️ Heavy snow', 77: '🌨️ Snow grains',
  80: '🌧️ Rain showers', 81: '🌧️ Rain showers', 82: '⛈️ Heavy rain showers',
  85: '🌨️ Snow showers', 86: '❄️ Heavy snow showers',
  95: '⛈️ Thunderstorm', 96: '⛈️ Thunderstorm + hail', 99: '⛈️ Thunderstorm + heavy hail',
};

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Geocoding service unavailable.');
  const data = await res.json();
  if (!data.results?.length) return null;
  return data.results[0];
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Weather service unavailable.');
  return await res.json();
}


/**
 * Comfort index — based on temperature + humidity.
 * Returns a short human-readable comfort label + clothing suggestion.
 */
function getComfortIndex(tempC, humidity) {
  const feels = tempC;
  if (feels < 0)       return { label: '🥶 Freezing',     tip: 'Heavy coat, gloves, scarf, layers.' };
  if (feels < 10)      return { label: '🧥 Very Cold',    tip: 'Warm jacket, layers, don\'t forget the scarf.' };
  if (feels < 18)      return { label: 'Cool',           tip: 'Light jacket or sweater.' };
  if (feels < 25)      return { label: '😊 Comfortable',   tip: 'T-shirt weather — maybe a light layer.' };
  if (feels < 30)      return { label: '☀️ Warm',          tip: 'Shorts and tees. Stay hydrated.' };
  if (feels < 35)      return { label: '🥵 Hot',           tip: 'Loose clothing, shade, lots of water.' };
  return { label: '🔥 Extreme Heat', tip: 'Stay indoors. AC, cold water, avoid exertion.' };
}

export default {
  name: 'weather',
  aliases: ['wx', 'forecast'],
  category: 'utility',
  description: 'Weather lookup for any city. Usage: .weather <city> | .weather <city> forecast',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const wantForecast = args[args.length - 1]?.toLowerCase() === 'forecast';
    const city = (wantForecast ? args.slice(0, -1) : args).join(' ').trim();

    if (!city) {
      return await m.reply.info(
        `Usage: \`${p}weather <city>\`\n\nExamples:\n• \`${p}weather Accra\` — current weather\n• \`${p}weather London forecast\` — 3-day forecast`,
        'WEATHER'
      );
    }

    await withReactionStatus(m, async () => {
      try {
        const geo = await geocode(city);
        if (!geo) {
          return await m.reply.error(`Could not find city "${city}". Check the spelling or try a nearby major city.`);
        }

        const data = await getWeather(geo.latitude, geo.longitude);
        const cur = data.current;
        const desc = WEATHER_CODES[cur.weather_code] || `Code ${cur.weather_code}`;

        if (wantForecast) {
          // ── 3-day forecast ─────────────────────────────────────────────
          const rows = data.daily.time.map((date, i) => {
            const dayDesc = WEATHER_CODES[data.daily.weather_code[i]] || 'Unknown';
            const dateLabel = new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
            return [
              dateLabel,
              dayDesc,
              `${Math.round(data.daily.temperature_2m_max[i])}°/${Math.round(data.daily.temperature_2m_min[i])}°C`,
            ];
          });

          try {
            await richTableCard(sock, m.from, {
              title:   `🌤️ 3-DAY FORECAST — ${geo.name}`,
              headers: ['Day', 'Conditions', 'High/Low'],
              rows,
              footer:  `Location: ${geo.name}, ${geo.country || ''} • Open-Meteo`,
            }, { quoted: m });

            await actionCard(sock, m.from, {
              text: `Currently: ${desc} • ${Math.round(cur.temperature_2m)}°C (feels like ${Math.round(cur.apparent_temperature)}°C)\n${getComfortIndex(Math.round(cur.apparent_temperature), cur.relative_humidity_2m).label} — ${getComfortIndex(Math.round(cur.apparent_temperature), cur.relative_humidity_2m).tip}`,
              footer: 'NEXORA • Weather',
            }, [
              { label: '🔍 Check Another City', cmd: `${p}weather` },
            ], { quoted: m });
          } catch (_) {
            const lines = rows.map(r => r.join('  '));
            await m.reply(asciiBuilder.box(`3-DAY FORECAST — ${geo.name}`, lines), { contextInfo: buildEnrichedContextInfo() });
          }
        } else {
          // ── Current weather ──────────────────────────────────────────────
          const comfort = getComfortIndex(Math.round(cur.apparent_temperature), cur.relative_humidity_2m);
          const text = `🌤️ *WEATHER — ${geo.name}, ${geo.country || ''}*\n\n${desc}\n🌡️ Temperature: ${Math.round(cur.temperature_2m)}°C (feels like ${Math.round(cur.apparent_temperature)}°C)\n💧 Humidity: ${cur.relative_humidity_2m}%\n💨 Wind: ${Math.round(cur.wind_speed_10m)} km/h\n\n${comfort.label} — ${comfort.tip}\n📍 ${geo.latitude.toFixed(2)}, ${geo.longitude.toFixed(2)}`;

          try {
            await mixedCard(sock, m.from, {
              text,
              footer: 'NEXORA • Open-Meteo',
            }, [
              { kind: 'action', label: '📅 3-Day Forecast', cmd: `${p}weather ${geo.name} forecast` },
              { kind: 'action', label: '🔍 Another City',   cmd: `${p}weather` },
            ], { quoted: m });
          } catch (_) {
            await m.reply(text, { contextInfo: buildEnrichedContextInfo() });
          }
        }
      } catch (err) {
        await m.reply.error(`Weather lookup failed: ${err.message}`);
      }
    });
  }
};
