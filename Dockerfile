# Root Dockerfile - use when Railway Root Directory = repo root
# If Root Directory = backend, Railway uses backend/Dockerfile instead
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY backend/ .

RUN npm run build
RUN ls -la dist/ && test -f dist/main.js

RUN npm ci --omit=dev
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "dist/main.js"]
