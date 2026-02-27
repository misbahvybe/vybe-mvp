# Single-stage build - avoids multi-stage COPY issues on Railway
# Use Debian Bullseye (11) - has OpenSSL 1.1; Bookworm (12) only has OpenSSL 3.x
FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .

RUN npm run build

RUN npm ci --omit=dev
RUN npx prisma generate

EXPOSE 4000

# NestJS outputs to dist/src/ when preserving source structure
CMD ["node", "dist/src/main.js"]
