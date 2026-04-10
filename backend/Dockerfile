# Single-stage build - avoids multi-stage COPY issues on Railway
# Use Debian Bullseye (11) - has OpenSSL 1.1; Bookworm (12) only has OpenSSL 3.x
FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

RUN npm ci
RUN node scripts/ensure-direct-url.cjs npx prisma generate

COPY . .

RUN npm run build

RUN npm ci --omit=dev
RUN npx prisma generate

EXPOSE 4000

# Apply pending DB migrations before boot (required when schema changes between deploys)
CMD ["sh", "-c", "node scripts/ensure-direct-url.cjs npx prisma migrate deploy && node dist/src/main.js"]
