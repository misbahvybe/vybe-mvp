# Vybe – Deployment Guide

This guide ensures your Vybe platform is production-ready. Add API keys to `.env` and deploy.

---

## ✅ Pre-Deployment Checklist

| Item | Status |
|------|--------|
| Database schema | ✅ Prisma schema complete |
| Backend APIs | ✅ Auth, Orders, Stores, Riders, Admin |
| Frontend flows | ✅ Customer, Store, Rider, Admin |
| Order flow | ✅ Full lifecycle (PENDING → DELIVERED) |
| Admin assign rider | ✅ Works on order detail page |
| Finance export | ✅ CSV export |
| Checkout redirect | ✅ Fixed to `/order/:id` |

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

Copy from `backend/.env.example`:

```env
# REQUIRED
DATABASE_URL="postgresql://..."     # Neon, Supabase, or any PostgreSQL
JWT_SECRET="..."                   # Min 32 chars, random
FRONTEND_URL="https://vybe-mvp.vercel.app" # Vercel frontend URL for CORS & invite links

# OPTIONAL
PORT=4000
JWT_EXPIRES_IN=7d
OTP_EXPIRY_MINUTES=3
OTP_MAX_ATTEMPTS=5

# WhatsApp – OTP (Meta Cloud API; required in production — see backend/.env.example)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_OTP_TEMPLATE_NAME=

# Geocoding for address picker
GEOAPIFY_API_KEY=

# Stripe – card payments (optional; omit = COD only)
STRIPE_SECRET_KEY=sk_live_xxx

# XPay Pakistan – card/wallet (optional; omit = COD only)
XPAY_API_KEY=
XPAY_ACCOUNT_ID=
XPAY_SECRET=
XPAY_TEST=false
XPAY_BASE_URL=https://community.xpay.app
XPAY_GATEWAY_INSTANCE_ID=
BACKEND_URL=https://api.your-app.com
```

### Frontend (`frontend/.env.local` or Vercel env vars)

Copy from `frontend/.env.example`:

```env
# Vercel: set this in Project → Settings → Environment Variables
NEXT_PUBLIC_API_URL=https://vybe-mvp-production.up.railway.app/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx   # Optional
```

**Important:** Replace `your-backend.up.railway.app` with your actual Railway URL. For Vybe MVP use `https://vybe-mvp-production.up.railway.app/api/v1`.

---

## 🚀 Deploy Steps

### 1. Database (run once after deploy)

```bash
cd backend
npx prisma db push
npm run prisma:seed
```

### 2. Backend (Railway)

- **Root Directory:** `backend` (or leave empty to use repo root – see below)
- **Required env:** `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`

**Dockerfile:** Railway auto-detects the Dockerfile.
- If Root Directory = `backend` → uses `backend/Dockerfile`
- If Root Directory = repo root (or empty) → uses root `Dockerfile` (builds from `backend/`)

Do **not** set a custom Start Command in Railway – let the Dockerfile CMD run.

### 3. Frontend (Vercel)

- **Root Directory:** `frontend`
- **Build Command:** `npm run build` (default)
- **Required env:** `NEXT_PUBLIC_API_URL` = `https://your-backend.up.railway.app/api/v1`

---

## 📱 What Works Without API Keys

| Feature | Without Keys | With Keys |
|---------|--------------|-----------|
| Customer signup | ✅ | ✅ |
| OTP verification | ✅ (logged to backend console in dev only) | ✅ (WhatsApp template) |
| Login | ✅ | ✅ |
| Browse stores, cart, checkout | ✅ | ✅ |
| Cash on Delivery | ✅ | ✅ |
| Card payments | ❌ (COD only) | ✅ (Stripe or XPay) |
| Address geocoding | ✅ (coordinates only) | ✅ (full address) |
| Partner invites | ✅ | ✅ |
| Admin dashboard | ✅ | ✅ |

---

## 🔐 Default Credentials (after seed)

- **Admin:** admin@vybe.pk / Admin123!
- **Store:** store1@vybe.pk / Store123!
- **Rider:** 3200002001@rider.vybe.pk / Rider123!
- **Customer:** customer1@test.pk / Customer123!

**Change these in production.**

---

## ⚠️ Notes

1. **XPay (Pakistan):** Use XPay for card/JazzCash/EasyPaisa in Pakistan. Add XPAY_API_KEY, XPAY_ACCOUNT_ID from [xpay.postexglobal.com](https://www.xpay.postexglobal.com/).
2. **Stripe + PKR:** Stripe may not support PKR. Use XPay for Pakistan. COD works without any gateway.
3. **Multi-store owners:** Store owners with multiple stores see only the first store in the dashboard. Use one store per owner or add store switching later.
4. **CORS:** Set `FRONTEND_URL` to your deployed frontend URL.
5. **Neon DB:** If paused, wake it via dashboard or a simple query before running migrations.

---

## 🔧 Troubleshooting 502 / CORS

If you see **502 Bad Gateway** or **CORS blocked** when calling the backend from Vercel:

1. **502 = backend not responding** – The CORS error is a side effect. When the server returns 502, it often omits CORS headers, so the browser reports CORS instead of the real issue.

2. **Check Railway logs** – In Railway → your service → Deployments → View Logs. Look for:
   - `Missing required env: DATABASE_URL, JWT_SECRET` → Add env vars in Railway → Variables
   - `Bootstrap failed:` → Shows the actual startup error
   - Database connection errors → Neon may be paused; wake it in the Neon dashboard

3. **Required env vars in Railway:**
   - `DATABASE_URL` – Neon connection string
   - `JWT_SECRET` – Min 32 chars
   - `FRONTEND_URL` – `https://vybe-mvp.vercel.app`

4. **Port binding** – The backend must listen on `0.0.0.0` (not localhost) so Railway’s proxy can reach it. This is already configured in `main.ts`.
