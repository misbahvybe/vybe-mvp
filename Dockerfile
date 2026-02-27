# Root Dockerfile - builds backend when Railway uses repo root
# If Root Directory = backend, Railway will use backend/Dockerfile instead
FROM node:18-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY backend/ .

RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/main.js"]
