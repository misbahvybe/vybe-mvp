# VYBE Superapp – Multi-Role Delivery Platform MVP

Production-grade MVP for a Lahore-based delivery platform (Customer, Captain, Store, Admin).

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, Zustand, Axios, PWA
- **Backend:** NestJS, TypeScript, PostgreSQL (Neon), Prisma, JWT, RBAC
- **Mobile:** Expo (React Native), shared API
- **Maps:** OpenStreetMap, Leaflet, Geoapify
- **OTP:** WhatsApp (Meta Cloud API template), hashed storage, 3-min expiry, rate limited
- **Realtime:** Socket.io on the API origin (JWT via `auth.token`); order pricing uses `PricingService` (see `backend/.env.example`)

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
- Mobile: `cd mobile && npm start` (set `backendUrl` in `app.json` / Expo `extra` if needed)

## Production deployment

1. **Database:** Run `npx prisma migrate deploy` (or `db push` only in non-prod experiments) against your Postgres URL.
2. **Backend:** Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (CORS + invite links), `BACKEND_URL` (callbacks), optional Stripe/XPay/WhatsApp and pricing vars in `backend/.env.example`.
3. **Frontend:** Set `NEXT_PUBLIC_API_URL` to your API base including `/api/v1` (e.g. `https://api.example.com/api/v1`).
4. **Realtime clients:** Connect Socket.IO to the API **host origin** (strip `/api/v1`); send JWT in `auth.token`.

## Project Structure

```
vybe-project/
├── frontend/          # Next.js PWA
├── backend/           # NestJS API
├── mobile/            # Expo app
└── package.json       # Root scripts
```

## Roles

- **Customer:** Browse stores, cart, place order, track delivery
- **Captain:** Accept orders, map route, mark picked/delivered
- **Store:** Accept orders, mark ready, view earnings
- **Admin:** Users, approve stores, assign captains, analytics, pricing & commission

## Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

## Payments

Optional **Stripe** and **XPay**; without keys, checkout supports COD and simulated saved cards for development. Configure keys per `.env.example`.
