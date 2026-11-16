FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runtime

RUN apk add --no-cache ffmpeg yt-dlp python3 ca-certificates tzdata

ENV NODE_ENV=production
ENV TZ=America/Santiago
ENV FFMPEG_BIN=/usr/bin/ffmpeg

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist/ ./dist/

RUN mkdir -p /app/logs && chown -R node:node /app

USER node

CMD ["node", "--max-old-space-size=384", "dist/index.js"]
