# ─── Backend Dockerfile ───────────────────────────────────────────────────────
# Build context: repo root  (because package.json lives there)
# docker-compose: context: .  dockerfile: backend/Dockerfile
# ──────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

# Install chromium deps required by Puppeteer (used for PDF generation)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy root package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy the backend source
COPY backend/ ./backend/

# Create uploads directory (files uploaded by users are stored here)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "backend/server.js"]
