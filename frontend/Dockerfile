# ─── Frontend Dockerfile ──────────────────────────────────────────────────────
# Build context: ./frontend
# Builds the Vite app then serves it with `vite preview`
# vite.config.js preview.proxy forwards /api → http://backend:5000
# ──────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the production bundle
RUN npm run build

EXPOSE 3000

# --host  → listen on 0.0.0.0 so Docker can forward the port
# --port  → match exposed port
CMD ["npx", "vite", "preview", "--host", "--port", "3000"]
