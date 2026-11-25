# --- Etapa 1: compilación TypeScript ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Etapa 2: dependencias de producción + addons nativos (@discordjs/opus, sodium-native) ---
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache python3 make g++ autoconf automake libtool
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm rebuild @discordjs/opus sodium-native \
    && node -e "require('@discordjs/opus'); require('sodium-native');" \
    && npm cache clean --force

# --- Etapa 3: runtime ---
# yt-dlp y ffmpeg vienen del sistema y se enlazan donde los paquetes npm los buscan.
FROM node:22-alpine AS runtime
RUN apk add --no-cache ffmpeg python3 py3-pip ca-certificates tzdata \
    && pip install --no-cache-dir --break-system-packages --root-user-action=ignore -U yt-dlp yt-dlp-ejs

# Envoltorio de FFmpeg: fija `-threads 1`.
# En la e2-micro (0.25 vCPU) el decode por defecto abre 2 hilos y satura la cuota
# (pico medido: 164 % de CPU). Con un solo hilo baja a 116 % y solo tarda 0.34 s
# más por minuto de audio, dejando CPU libre para Node.
RUN printf '#!/bin/sh\nexec /usr/bin/ffmpeg -threads 1 "$@"\n' > /usr/local/bin/ffmpeg-1thread \
    && chmod +x /usr/local/bin/ffmpeg-1thread

WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
RUN mkdir -p /app/node_modules/ytdlp-nodejs/bin /app/.cache \
    && ln -sf /usr/bin/yt-dlp /app/node_modules/ytdlp-nodejs/bin/yt-dlp_musllinux \
    && ln -sf /usr/bin/yt-dlp /app/node_modules/ytdlp-nodejs/bin/yt-dlp_linux \
    && ln -sf /usr/bin/yt-dlp /app/node_modules/ytdlp-nodejs/bin/yt-dlp \
    && ln -sf /usr/local/bin/ffmpeg-1thread /app/node_modules/ffmpeg-static/ffmpeg

# Caché de yt-dlp fuera de /tmp: conserva la resolución de firma/nsig entre
# pistas y reinicios. Sin esto, cada pista vuelve a pagar el challenge.
ENV XDG_CACHE_HOME=/app/.cache
COPY --from=builder /app/dist/ ./dist/
RUN mkdir -p /app/logs /app/preload && chown -R node:node /app
USER node
CMD ["node", "dist/index.js"]
