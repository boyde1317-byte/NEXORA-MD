import crypto from 'crypto';

const cache = new Map();

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

        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else if (contentType.includes('text/')) {
          data = await response.text();
        } else {
          data = Buffer.from(await response.arrayBuffer());
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
    const { data } = await webClient.fetch(url, { useCache: true, cacheTtl: 300000 });
    return data;
  },
  weather: async (query) => {
    const { data } = await webClient.fetch(`https://wttr.in/${encodeURIComponent(query)}?format=j1`, { useCache: true });
    return data;
  },
  translate: async (text, targetLang = 'en') => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const { data } = await webClient.fetch(url);
    if (!data || !data[0]) throw new Error('Translation failed');
    return data[0].map(item => item[0]).join('');
  },
  define: async (word) => {
    const { data } = await webClient.fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { useCache: true });
    return data;
  },
  
  // Developer
  github: async (repo) => {
    const { data } = await webClient.fetch(`https://api.github.com/repos/${repo}`, { useCache: true });
    return data;
  },
  npm: async (pkg) => {
    const { data } = await webClient.fetch(`https://registry.npmjs.org/${pkg}`, { useCache: true });
    return data;
  },
  docs: async (query) => {
    const { data } = await webClient.fetch(`https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}`, { useCache: true });
    return data;
  },

  // Web
  summary: async (url) => {
    // We could use an external free API like smmry or similar, but often they need keys.
    // Let's use a public summarizer or just standard readablity parsing if we could.
    // For now, let's use Wikipedia summary if it's a topic, or use text parsing.
    // Wait, the prompt says "summary" could summarize an article.
    const { data } = await webClient.fetch(`https://smmry.com/api?SM_API_KEY=${process.env.SMMRY_API_KEY || ''}&SM_URL=${encodeURIComponent(url)}`);
    return data;
  },
  dns: async (domain) => {
    const { data } = await webClient.fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}`, { useCache: true });
    return data;
  },
  whois: async (domain) => {
    const { data } = await webClient.fetch(`https://networkcalc.com/api/dns/whois/${encodeURIComponent(domain)}`, { useCache: true });
    return data;
  },
  headers: async (url) => {
    const { headers } = await webClient.fetch(url, { method: 'HEAD' });
    const obj = {};
    headers.forEach((v, k) => obj[k] = v);
    return obj;
  },
  screenshot: async (url) => {
    const apiUrl = `https://api.screenshotmachine.com/?key=demo&url=${encodeURIComponent(url)}&dimension=1366x768&format=jpg&cacheLimit=0`;
    const { data } = await webClient.fetch(apiUrl, { timeout: 25000 });
    return data;
  },

  // Utility
  currency: async (base = 'USD') => {
    const { data } = await webClient.fetch(`https://api.exchangerate-api.com/v4/latest/${base.toUpperCase()}`, { useCache: true, cacheTtl: 3600000 });
    return data;
  },
  time: async (timezone) => {
    const { data } = await webClient.fetch(`https://worldtimeapi.org/api/timezone/${timezone}`, { useCache: true });
    return data;
  },
  calculator: async (expr) => {
    const { data } = await webClient.fetch(`https://api.mathjs.org/v4/?expr=${encodeURIComponent(expr)}`);
    return data;
  }
};
