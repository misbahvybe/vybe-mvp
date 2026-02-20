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
FRONTEND_URL="https://your-app.com" # Your frontend URL for CORS & invite links

# OPTIONAL
PORT=4000
JWT_EXPIRES_IN=7d
OTP_EXPIRY_MINUTES=3
OTP_MAX_ATTEMPTS=5

# SMS – OTP (optional; if empty, OTP logged to console)
SMS_PROVIDER_URL=
SMS_API_KEY=

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

### Frontend (`frontend/.env.local`)

Copy from `frontend/.env.example`:

```env
NEXT_PUBLIC_API_URL=https://api.your-app.com/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx   # Optional
```

---

## 🚀 Deploy Steps

### 1. Database

```bash
cd backend
npx prisma db push
npm run prisma:seed
```

### 2. Backend

```bash
cd backend
npm run build
npm run start:prod
# Or use: node dist/main.js
```

### 3. Frontend

```bash
cd frontend
npm run build
npm run start
# Or deploy to Vercel/Netlify
```

---

## 📱 What Works Without API Keys

| Feature | Without Keys | With Keys |
|---------|--------------|-----------|
| Customer signup | ✅ | ✅ |
| OTP verification | ✅ (logged to backend console) | ✅ (SMS sent) |
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
2. **Multi-store owners:** Store owners with multiple stores see only the first store in the dashboard. Use one store per owner or add store switching later.
3. **CORS:** Set `FRONTEND_URL` to your deployed frontend URL.
4. **Neon DB:** If paused, wake it via dashboard or a simple query before running migrations.
