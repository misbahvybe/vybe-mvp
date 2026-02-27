# Single-stage build - avoids multi-stage COPY issues on Railway
FROM node:18-alpine

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
