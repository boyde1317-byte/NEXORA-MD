import crypto from 'crypto';

const cache = new Map();

// Max response body size — 10MB. Prevents OOM from large/malicious responses.
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export class WebClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000;
    this.retries = options.retries || 2;
  }

  async fetch(url, options = {}) {
    const { retries = this.retries, useCache = false, cacheTtl = 60000, ...fetchOptions } = options;
    const cacheKey = useCache ? crypto.createHash('md5').update(url + JSON.stringify(fetchOptions)).digest('hex') : null;

    if (useCache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTtl) {
        return cached.data;
      }
      cache.delete(cacheKey);
    }

    let lastError;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
        clearTimeout(id);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // ── Guard against oversized responses ────────────────────────────
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_RESPONSE_BYTES) {
          throw new Error(`Response too large: ${contentLength} bytes exceeds ${MAX_RESPONSE_BYTES} limit`);
        }

        const contentType = response.headers.get('content-type') || '';
        let data;

        if (contentType.includes('application/json')) {
          // Read as text first, then parse — allows size checking before full allocation
          const text = await response.text();
          if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
            throw new Error(`Response body exceeds ${MAX_RESPONSE_BYTES} byte limit`);
          }
          data = JSON.parse(text);
        } else if (contentType.includes('text/')) {
          data = await response.text();
          if (Buffer.byteLength(data) > MAX_RESPONSE_BYTES) {
            throw new Error(`Response body exceeds ${MAX_RESPONSE_BYTES} byte limit`);
          }
        } else {
          const buf = Buffer.from(await response.arrayBuffer());
          if (buf.length > MAX_RESPONSE_BYTES) {
            throw new Error(`Response body exceeds ${MAX_RESPONSE_BYTES} byte limit`);
          }
          data = buf;
        }

        if (useCache && cacheKey) {
          cache.set(cacheKey, { timestamp: Date.now(), data });
        }
        return { data, headers: response.headers, status: response.status };
      } catch (error) {
        lastError = error;
        if (attempt <= retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    throw lastError;
  }
}

export const webClient = new WebClient();

export const Providers = {
  // Search
  search: async (query) => {
    const { data } = await webClient.fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    return data;
  },
  news: async (query, apiKey) => {
    if (!apiKey) throw new Error("NEWS_API_KEY environment variable is required.");
    const url = query
      ? `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${apiKey}`
      : `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`;
    const { data } = await webClient.fetch(url);
    return data;
  },
  summary: async (url, apiKey) => {
    if (!apiKey) throw new Error("SMMRY_API_KEY environment variable is required.");
    const { data } = await webClient.fetch(`https://smmry.com/api?SM_API_KEY=${apiKey}&SM_URL=${encodeURIComponent(url)}`);
    return data;
  },
  omdb: async (title, apiKey) => {
    if (!apiKey) throw new Error("OMDB_API_KEY environment variable is required.");
    const { data } = await webClient.fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`);
    return data;
  },
  // Currency
  currency: async (from, to) => {
    const { data } = await webClient.fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
    const rate = data?.rates?.[to.toUpperCase()];
    if (!rate) throw new Error(`Could not find exchange rate for ${from.toUpperCase()}/${to.toUpperCase()}`);
    return { rate, date: data.date };
  },
  // Weather (Open-Meteo — no API key needed)
  weather: async (city) => {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const { data: geoData } = await webClient.fetch(geoUrl);
    if (!geoData?.results?.length) throw new Error(`City "${city}" not found`);
    const { latitude, longitude, name, country } = geoData.results[0];
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;
    const { data: weatherData } = await webClient.fetch(weatherUrl);
    return { ...weatherData, location: { name, country } };
  },
};

export default { webClient, Providers };
