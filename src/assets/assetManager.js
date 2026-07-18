import fs from 'node:fs';
import path from 'node:path';
import { ensureDefaultAssets, DEFAULT_PATHS } from './defaultAssets.js';
import { assetValidator } from './assetValidator.js';
import { aiAssetGenerator } from './aiAssetGenerator.js';

const ASSETS_DB_PATH = path.join(process.cwd(), 'database', 'assets.json');

// Required asset configurations with prompts and output paths
export const REQUIRED_AI_ASSETS = {
  menu1: {
    prompt: 'Professional tech document card background, dark slate background with neon cyan vector geometric lines, abstract, minimalist digital art, featuring the branding text "NEXORA MD" and "By Aizen" clearly, 16:9',
    targetPath: './media/images/menu/menu1/menu1_generated.jpg',
    defaultPath: DEFAULT_PATHS.menuBanner
  },
  menu2: {
    prompt: 'Premium payment style card background, elegant dark charcoal canvas with luxurious metallic rose gold accents, abstract, minimalist digital art, featuring the branding text "NEXORA MD" and "By Aizen" clearly, 16:9',
    targetPath: './media/images/menu/menu2/menu2_generated.jpg',
    defaultPath: DEFAULT_PATHS.menuBanner
  },
  menu3: {
    prompt: 'Event announcement background, deep purple and ultraviolet glow with floating abstract particles, vibrant, futuristic digital render, featuring the branding text "NEXORA MD" and "By Aizen" clearly, 16:9',
    targetPath: './media/images/menu/menu3/menu3_generated.jpg',
    defaultPath: DEFAULT_PATHS.menuBanner
  },
  menu4: {
    prompt: 'Modern interactive bot dashboard background, clean futuristic glassmorphism interface with dark slate and holographic green highlights, digital art, featuring the branding text "NEXORA MD" and "By Aizen" clearly, 16:9',
    targetPath: './media/images/menu/menu4/menu4_generated.jpg',
    defaultPath: DEFAULT_PATHS.menuBanner
  },
  welcome: {
    prompt: 'Group welcome banner, welcoming serene nature forest at dawn with majestic glowing mountains, warm golden hour light, beautiful digital illustration, featuring the branding text "NEXORA MD" and "By Aizen" clearly, 16:9',
    targetPath: './media/images/greetings/welcome_generated.jpg',
    defaultPath: DEFAULT_PATHS.welcome
  },
  goodbye: {
    prompt: 'Group goodbye banner, peaceful starry night sky with a warm crescent moon over quiet hills, gentle retro palette, beautiful digital illustration, featuring the branding text "NEXORA MD" and "By Aizen" clearly, 16:9',
    targetPath: './media/images/greetings/goodbye_generated.jpg',
    defaultPath: DEFAULT_PATHS.goodbye
  }
};

export const assetManager = {
  /**
   * Loads assets database
   */
  loadAssetsDb() {
    try {
      const dir = path.dirname(ASSETS_DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(ASSETS_DB_PATH)) {
        fs.writeFileSync(ASSETS_DB_PATH, JSON.stringify({}, null, 2), 'utf-8');
      }
      const content = fs.readFileSync(ASSETS_DB_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('[ASSET MANAGER] Load DB failed, returning empty:', err);
      return {};
    }
  },

  /**
   * Saves assets database
   */
  saveAssetsDb(data) {
    try {
      const dir = path.dirname(ASSETS_DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ASSETS_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[ASSET MANAGER] Save DB failed:', err);
      return false;
    }
  },

  /**
   * Registers a manual override asset (e.g. set by owner command)
   */
  registerManualAsset(key, localPath) {
    const db = this.loadAssetsDb();
    db[key] = {
      source: 'manual',
      path: localPath
    };
    this.saveAssetsDb(db);
    console.log(`[ASSET MANAGER] Asset "${key}" registered with MANUAL source: ${localPath}`);
  },

  /**
   * Registers an AI generated asset
   */
  registerAIAsset(key, localPath) {
    const db = this.loadAssetsDb();
    db[key] = {
      source: 'ai',
      path: localPath
    };
    this.saveAssetsDb(db);
    console.log(`[ASSET MANAGER] Asset "${key}" registered with AI source: ${localPath}`);
  },

  /**
   * Resolves the highest priority active path for the given asset key
   * Priority: User custom (manual) -> AI generated -> Default fallback -> Text-only fallback (or fallback URL)
   * @param {string} key - e.g. menu1, welcome, goodbye
   * @returns {string} - Absolute or relative local path to the file
   */
  getAsset(key) {
    const db = this.loadAssetsDb();
    const config = REQUIRED_AI_ASSETS[key];
    const defaultPath = config ? config.defaultPath : DEFAULT_PATHS.menuBanner;

    // 1. Check database for custom or AI paths
    if (db[key]) {
      const entry = db[key];
      const check = assetValidator.validate(entry.path);
      if (check.valid) {
        return entry.path;
      } else {
        console.warn(`[ASSET MANAGER] DB entry for "${key}" is invalid (${check.error}). Falling back.`);
      }
    }

    // 2. Fall back to AI generated path directly if it exists on disk and is valid
    if (config) {
      const checkAI = assetValidator.validate(config.targetPath);
      if (checkAI.valid) {
        return config.targetPath;
      }
    }

    // 3. Fall back to built-in default asset
    const checkDefault = assetValidator.validate(defaultPath);
    if (checkDefault.valid) {
      return defaultPath;
    }

    // 4. Ultimate text-only fallback URL
    return 'https://i.pinimg.com/736x/32/cb/59/32cb598a2eb31bce70cf7c653ff9d10d.jpg';
  },

  /**
   * Main startup execution flow: ensures default folders, generates missing images via Gemini if enabled
   */
  async init() {
    console.log('[ASSET MANAGER] Initializing smart asset management system...');

    // A. Ensure default built-in folders and assets are prepared
    await ensureDefaultAssets();

    // B. Check missing assets and generate if Gemini is available
    const db = this.loadAssetsDb();
    const geminiAvailable = aiAssetGenerator.isEnabled();

    console.log(`[ASSET MANAGER] Gemini AI generation capability is: ${geminiAvailable ? 'ENABLED' : 'DISABLED'}`);

    for (const [key, config] of Object.entries(REQUIRED_AI_ASSETS)) {
      // Check if we already have a valid manual override or AI path
      let needGeneration = true;

      if (db[key]) {
        const entry = db[key];
        // If it's manual, we NEVER overwrite it
        if (entry.source === 'manual') {
          const checkManual = assetValidator.validate(entry.path);
          if (checkManual.valid) {
            console.log(`[ASSET MANAGER] Asset "${key}" has valid manual override: ${entry.path}. Skipping AI check.`);
            needGeneration = false;
          }
        } else if (entry.source === 'ai') {
          const checkAI = assetValidator.validate(entry.path);
          if (checkAI.valid) {
            console.log(`[ASSET MANAGER] Asset "${key}" has valid existing AI image: ${entry.path}.`);
            needGeneration = false;
          }
        }
      } else {
        // Double check direct disk path
        const checkDisk = assetValidator.validate(config.targetPath);
        if (checkDisk.valid) {
          console.log(`[ASSET MANAGER] Asset "${key}" exists on disk at ${config.targetPath}. Caching.`);
          this.registerAIAsset(key, config.targetPath);
          needGeneration = false;
        }
      }

      if (needGeneration) {
        if (geminiAvailable) {
          console.log(`[ASSET MANAGER] Asset "${key}" is missing or invalid. Requesting AI generation...`);
          try {
            const buffer = await aiAssetGenerator.generateImage(config.prompt, '16:9');
            
            // Auto optimize before saving
            const optimized = assetValidator.optimize(buffer);

            // Write to local target path
            const targetFullPath = path.isAbsolute(config.targetPath) 
              ? config.targetPath 
              : path.resolve(process.cwd(), config.targetPath);

            const dir = path.dirname(targetFullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(targetFullPath, optimized);
            this.registerAIAsset(key, config.targetPath);
            console.log(`[ASSET MANAGER] AI image successfully generated and saved for "${key}" at ${config.targetPath}`);
          } catch (err) {
            console.error(`[ASSET MANAGER] Failed to generate AI asset for "${key}":`, err.message || err);
            console.log(`[ASSET MANAGER] Asset "${key}" will gracefully fallback to default placeholder.`);
          }
        } else {
          console.log(`[ASSET MANAGER] Asset "${key}" is missing, but Gemini is not configured or disabled. Default fallback will be active.`);
        }
      }
    }

    console.log('[ASSET MANAGER] Initialization complete.');
  },

  /**
   * Regenerates all AI assets (overwriting existing AI assets, but leaving manual assets untouched)
   */
  async regenerateAll() {
    const geminiAvailable = aiAssetGenerator.isEnabled();
    if (!geminiAvailable) {
      throw new Error('Gemini API is not configured or GENERATE_ASSETS is not set to true.');
    }

    const db = this.loadAssetsDb();

    for (const [key, config] of Object.entries(REQUIRED_AI_ASSETS)) {
      if (db[key] && db[key].source === 'manual') {
        console.log(`[ASSET MANAGER] Skipping regeneration for "${key}" due to MANUAL override.`);
        continue;
      }

      console.log(`[ASSET MANAGER] Regenerating AI asset "${key}"...`);
      try {
        const buffer = await aiAssetGenerator.generateImage(config.prompt, '16:9');
        const optimized = assetValidator.optimize(buffer);

        const targetFullPath = path.isAbsolute(config.targetPath) 
          ? config.targetPath 
          : path.resolve(process.cwd(), config.targetPath);

        const dir = path.dirname(targetFullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(targetFullPath, optimized);
        this.registerAIAsset(key, config.targetPath);
        console.log(`[ASSET MANAGER] AI image successfully regenerated for "${key}" at ${config.targetPath}`);
      } catch (err) {
        console.error(`[ASSET MANAGER] Failed to regenerate AI asset for "${key}":`, err.message);
      }
    }
  }
};

export default assetManager;
