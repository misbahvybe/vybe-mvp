# Vybe – Multi-Role Delivery Platform MVP

Production-grade MVP for a Lahore-based delivery platform (Customer, Rider, Store, Admin).

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, Zustand, Axios, PWA
- **Backend:** NestJS, TypeScript, PostgreSQL (Neon), Prisma, JWT, RBAC
- **Maps:** OpenStreetMap, Leaflet, Geoapify
- **OTP:** SMS-based, hashed storage, 3-min expiry, rate limited

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Copy env files and set DATABASE_URL, JWT_SECRET, etc.
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Generate Prisma client & push schema
npm run db:generate
npm run db:push

# Run dev (backend + frontend)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/v1

## Project Structure

```
vybe-project/
├── frontend/          # Next.js PWA
├── backend/           # NestJS API
└── package.json       # Root scripts
```

## Roles

- **Customer:** Browse stores, cart, place order, track delivery
- **Rider:** Accept orders, map route, mark picked/delivered
- **Store:** Accept orders, mark ready, view earnings
- **Admin:** Users, approve stores, assign riders, analytics

## Environment Variables

See `backend/.env.example` and `frontend/.env.example`.
