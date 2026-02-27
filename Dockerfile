# Root Dockerfile - use when Railway Root Directory = repo root
# If Root Directory = backend, Railway uses backend/Dockerfile instead
# Use Debian slim (not Alpine) - Prisma needs libssl which Alpine 3.17+ lacks
FROM node:18-slim

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
