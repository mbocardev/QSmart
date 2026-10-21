# ─────────────────────────────────────────────
# Stage 1 : build
# ─────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json ./

RUN npm install \
      @sveltejs/kit@^2.5.0 \
      @sveltejs/vite-plugin-svelte@^3.1.0 \
      @sveltejs/adapter-node@^5.0.0 \
      svelte@^4.2.7 \
      vite@^5.0.3 \
      autoprefixer@^10.4.16 \
      postcss@^8.4.32 \
      tailwindcss@^3.4.0 \
      typescript@^5.0.0 \
      svelte-check@^3.6.0 \
      --save-dev \
    && npm install \
      @supabase/supabase-js@^2.39.0 \
      otplib@^12.0.1 \
      qrcode@^1.5.3

COPY . .

# Remplacer adapter-vercel par adapter-node
RUN sed -i "s|@sveltejs/adapter-vercel|@sveltejs/adapter-node|g" svelte.config.js

RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 : image de production légère
# ─────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "build/index.js"]
