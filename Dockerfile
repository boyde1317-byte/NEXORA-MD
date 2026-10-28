FROM node:20-slim

WORKDIR /app

# git + ca-certificates are needed to fetch the baileys git dependency —
# node:20-slim ships neither. Must come BEFORE any git command below.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp is the self-hosted fallback source for Instagram: the hosted route is
# quota-based and answers HTTP 401 once its shared upstream budget is spent, so
# it needs a real second extractor rather than more retries. This is the
# standalone PyInstaller build, so no Python runtime is required. Non-fatal on
# purpose — if the download fails the build still succeeds and the bot simply
# falls back to the hosted API alone.
RUN curl -fsSL --retry 3 --max-time 180 \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version \
    || echo "WARN: yt-dlp not installed - Instagram local fallback disabled"

# Copy package files first for better Docker layer caching
# Wildcard: package-lock.json was removed from the repo (111f3ad),
# so copy whichever package files exist — never error on a missing lock.
COPY package*.json ./
# git deps in the lock resolve over ssh by default — rewrite to https so
# keyless CI builds can fetch them
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
COPY scripts/patch-libsignal.js ./scripts/

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application code
COPY . .

# Ensure session and temp directories exist
RUN mkdir -p session /tmp/nexora-media

# Create a non-root user and switch to it for security
RUN groupadd -r botuser && useradd -r -g botuser -d /app botuser && \
    chown -R botuser:botuser /app
USER botuser

# Expose the web server port
EXPOSE 3000

# Health check — checks both HTTP status and that the bot process is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
