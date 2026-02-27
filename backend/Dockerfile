# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDependencies for nest build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

COPY . .

# Build NestJS
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production deps only
RUN npm ci --omit=dev

# Generate Prisma client for production
RUN npx prisma generate

# Copy built output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/main.js"]
