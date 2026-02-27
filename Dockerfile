# Root Dockerfile - use when Railway Root Directory = repo root
# If Root Directory = backend, Railway uses backend/Dockerfile instead
# Use Debian Bullseye - has OpenSSL 1.1 for Prisma
FROM node:18-bullseye-slim

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY backend/ .

RUN npm run build

RUN npm ci --omit=dev
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
