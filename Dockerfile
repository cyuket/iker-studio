# Reproducible render environment: the same Node, FFmpeg and browsers as CI.
# Build:  docker build -t iker-video-studio .
# Use:    docker run --rm --env-file .env -v "$PWD/output:/app/output" iker-video-studio doctor
FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

WORKDIR /app

# Dependencies first, so source edits do not invalidate the install layer.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod=false

# Chromium for recording (with its system libraries) and Chrome Headless Shell for rendering.
RUN pnpm exec playwright install --with-deps chromium \
    && pnpm exec remotion browser ensure

COPY . .

# Secrets come from the environment at run time and are never baked into the image.
ENTRYPOINT ["pnpm", "--silent", "studio"]
CMD ["--help"]
