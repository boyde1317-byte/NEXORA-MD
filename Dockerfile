FROM node:20-slim

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json package-lock.json ./
COPY scripts/patch-libsignal.js ./scripts/

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application code
COPY . .

# Ensure session directory exists
RUN mkdir -p session

# Create a non-root user and switch to it for security
RUN groupadd -r botuser && useradd -r -g botuser -d /app botuser && \
    chown -R botuser:botuser /app
USER botuser

# Expose the web server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
