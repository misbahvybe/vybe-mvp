# Payment Methods – Integration Guide

The payment flow is **fully implemented** with optional Stripe support.

---

## Current State

| Component | Status | Notes |
|-----------|--------|------|
| **Payment Methods page** | ✅ Complete | Add, remove, set default. Stripe Elements when key present, fallback form otherwise |
| **Checkout – payment selection** | ✅ Complete | COD or saved card |
| **Card storage** | ✅ Backend API | `SavedPaymentMethod` in DB, CRUD via `/users/me/payment-methods` |
| **Order creation with CARD** | ✅ Complete | Validates `paymentMethodId` or `paymentIntentId` |
| **Stripe charging** | ✅ Optional | When `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set |

---

## Two Modes

### 1. Simulated (no Stripe keys)

- Add card: Manual form (last4, cardType) → stored in DB
- Checkout: Uses `paymentMethodId`, order created with `paymentStatus: PAID` (no real charge)
- Use for local/dev when Stripe is not configured

### 2. Stripe (keys configured)

- Add card: Stripe Elements → `createPaymentMethod()` → `pm_xxx` sent to backend
- Backend: Creates Stripe Customer, attaches PM, stores in DB
- Checkout: `POST /orders/payment-intent` → `stripe.confirmCardPayment()` → `POST /orders` with `paymentIntentId`
- Real charge in PKR (paisas)

---

## Backend APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /users/me/payment-methods` | GET | List saved cards |
| `POST /users/me/payment-methods` | POST | Add card – `{ paymentMethodId }` (Stripe) or `{ last4, cardType }` (simulated) |
| `PATCH /users/me/payment-methods/:id/default` | PATCH | Set default |
| `DELETE /users/me/payment-methods/:id` | DELETE | Remove card |
| `POST /orders/payment-intent` | POST | Create Stripe PaymentIntent – `{ amount, paymentMethodId }` |
| `POST /orders` | POST | Create order – `paymentMethodId` or `paymentIntentId` when CARD |

---

## Environment

### Backend (`.env`)
```
STRIPE_SECRET_KEY=sk_test_xxx   # Optional – omit for simulated mode
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx   # Optional
```

---

## Stripe Flow Summary

1. **Add card**
   - Frontend: Stripe Elements → `createPaymentMethod()` → `pm_xxx`
   - Backend: `attachPaymentMethod`, save to `SavedPaymentMethod`

2. **Place order (CARD)**
   - Frontend: `POST /orders/payment-intent` → `confirmCardPayment(clientSecret)`
   - Backend: `POST /orders` with `paymentIntentId` → verify succeeded → create order

3. **Delete card**
   - Backend: `detachPaymentMethod` for Stripe PMs, then delete from DB

---

## Database

`SavedPaymentMethod` model:
- `providerId` – Stripe `pm_xxx` or `internal_xxx` for simulated
- `last4`, `brand`, `isDefault`
- `User.stripeCustomerId` – Stripe Customer when using Stripe

---

## Production Checklist

- [ ] Add Stripe keys (test, then live)
- [ ] Run migration `add_stripe_customer_id`
- [ ] Use Stripe live keys for production
- [ ] Configure Stripe webhooks if needed (e.g. for async payment status)
