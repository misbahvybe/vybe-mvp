# Single-stage build - avoids multi-stage COPY issues on Railway
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .

RUN npm run build

# Verify dist exists (helps debug if build fails)
RUN ls -la dist/ && test -f dist/main.js

RUN npm ci --omit=dev
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "dist/main.js"]
