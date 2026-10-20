FROM node:22-bookworm-slim

# ffmpeg: video processing · git/make/g++/cmake: builds whisper.cpp on first run
# chromium libs: Remotion's headless browser · noto emoji: emoji overlays in renders
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg git make g++ cmake ca-certificates curl \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libasound2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI: the editor runs as `claude -p` with your subscription.
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
 && node --input-type=module -e "import { ensureBrowser } from '@remotion/renderer'; await ensureBrowser();"

RUN useradd -m vibe && mkdir -p /data && chown -R vibe:vibe /data /app
USER vibe

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CLAUDE_CONFIG_DIR=/data/.claude

VOLUME /data
EXPOSE 8787
CMD ["node_modules/.bin/tsx", "server/index.ts"]
