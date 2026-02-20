# Vybe – Setup & Run Guide

## Prerequisites
- Node.js 18+
- PostgreSQL (or Neon cloud DB)
- npm or pnpm

## 1. Backend Setup

```powershell
cd backend
npm install
```

### Environment
Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – Min 32 characters (e.g. `your-super-secret-jwt-key-min-32-chars`)
- `FRONTEND_URL` – Default `http://localhost:3000`
- `STRIPE_SECRET_KEY` – (optional) For real card charging. Omit for simulated dev flow.

### Database
```powershell
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### Run
```powershell
npm run start:dev
```

**Seed credentials:**
- **Admin:** `admin@vybe.pk` / `Admin123!` → `/admin`
- **Store Owner:** `store@vybe.pk` / `Store123!` → `/store/dashboard`

**OTP (dev):** Without SMS config, OTP codes are printed in the backend console.

---

## 2. Frontend Setup

```powershell
cd frontend
npm install
```

### Environment (optional)
Create `.env.local` if API is not on `localhost:4000`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
# Stripe – omit for simulated card flow (dev mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### Run
```powershell
npm run dev
```

---

## 3. Test Flows

### Customer
1. **Sign up:** `/auth/signup` → form → OTP (check backend console) → verify → dashboard
2. **Login:** `/auth/login` with email/phone + password → dashboard
3. **Order:** Dashboard → Category → Store → Add to cart → Checkout → Place order
4. **Card payments:** Profile → Payment Methods → Add card (stored in DB). Use saved card at checkout for CARD payment.

### Admin
1. **Login:** `/auth/login` → `admin@vybe.pk` / `Admin123!` → Admin panel
2. **Invite partner:** Admin → Partners → Invite Partner → Copy invite link

### Store Owner
1. **Login:** `/auth/login` or `/partner-login` → `store@vybe.pk` / `Store123!` → Store dashboard
2. **Manage orders:** Store dashboard → click order → Accept/Reject or Mark Ready for pickup

### Rider
1. **Login:** `/auth/login` or `/partner-login` (rider account) → Rider dashboard
2. **Deliver:** Admin assigns rider to READY_FOR_PICKUP orders. Rider dashboard → Accept → Pick up → Deliver

### Order state machine & MVP improvements
- Run `npx prisma migrate deploy` to apply migrations:
  - `order_state_machine` – STORE_REJECTED, OrderStatusHistory, cancellationReason
  - `mvp_improvements` – inventory (stock, isOutOfStock), store hours (openingTime, closingTime), subtotal/serviceFee/totalAmount, CancellationReason enum

---

## 4. Troubleshooting

- **500 / module errors:** Clear Next.js cache: `Remove-Item -Recurse -Force .next`
- **DB connection failed:** Check `DATABASE_URL`, network, and DB status (e.g. Neon dashboard)
- **401 on API:** Token expired or invalid – you’ll be redirected to login
