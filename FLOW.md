# Vybe – Complete Flow Documentation

This document explains how every user flow works end-to-end in the Vybe delivery platform.

**Pitch alignment:** 15% commission, Rs 23.49 service fee, 90–120 min delivery promise, crypto/Binance coming soon.

---

## 1. Landing Page Flow

**Route:** `/`

1. User sees a 3-slide carousel:
   - Slide 1: Food delivery
   - Slide 2: Grocery
   - Slide 3: Medicine

2. User taps **Continue** to move through slides.

3. After the last slide, user sees:
   - **Order Now** → goes to `/auth/signup`
   - **Customer Login** → goes to `/auth/login`
   - **Sign up** → goes to `/auth/signup`

**Note:** There is no public "Become a Rider" or "Partner Store" link. Partners are created only by Admin via invite.

---

## 2. Customer Signup Flow

**Route:** `/auth/signup`

1. User fills form: Name, Email, WhatsApp number, Password, Confirm password.
2. User taps **Continue**.
3. **Backend:** `POST /auth/signup`
   - Creates user with role `CUSTOMER`, hashed password.
   - Generates OTP, stores it (hashed), sends via SMS (or logs to console if no SMS config).
   - Returns: `{ message, userId, phone, expiresAt }`.
4. Frontend shows OTP input screen.
5. User enters 6-digit OTP.
6. User taps **Verify & Continue**.
7. **Backend:** `POST /auth/verify-otp` with `{ phone, code }`
   - Verifies OTP.
   - Sets `isVerified: true` for the user.
   - Returns JWT + user.
8. Frontend stores token in `localStorage` and auth store, then redirects to `/dashboard`.

---

## 3. Customer Login Flow

**Route:** `/auth/login`

1. User enters email or phone + password.
2. User taps **Login**.
3. **Backend:** `POST /auth/login` with `{ emailOrPhone, password }`
   - Finds user by email or normalized phone.
   - Verifies password with bcrypt.
   - Returns JWT + user.
4. Frontend stores token and user, redirects by role:
   - `CUSTOMER` → `/dashboard`
   - `RIDER` → `/rider/dashboard`
   - `STORE_OWNER` → `/store/dashboard`
   - `ADMIN` → `/admin`

---

## 4. Customer Order Flow

### 4.1 Browse & Add to Cart

1. User is on **Dashboard** (`/dashboard`).
2. User taps a category (Food, Grocery, Medicine, etc.) or goes to **Stores**.
3. **Backend:** `GET /stores?category=food|grocery|medicine` returns approved stores filtered by category.
4. User selects a store → **Store Detail** (`/dashboard/stores/[id]`).
5. **Backend:** `GET /stores/:id` returns store + products.
6. User taps **+** to add a product to cart.
7. Cart is stored in Zustand + `localStorage` (persist). No API call until checkout.

### 4.2 Checkout

1. User goes to **Cart** (`/cart`).
2. User taps **Checkout**.
3. **Checkout page** (`/cart/checkout`):
   - **Backend:** `GET /users/me/addresses` loads saved addresses.
   - User selects delivery address (or adds one at `/addresses/new`).
   - User selects payment: Cash on Delivery (COD), Card, or Crypto (Coming Soon).
4. User taps **Place order**.
5. **Backend:** `POST /orders` with:
   - `storeId`, `addressId`, `items: [{ productId, quantity, price }]`, `paymentMethod`
   - Creates order, store earning, order items.
6. Frontend clears cart and redirects to `/order/[id]`.

### 4.3 View Orders

1. **Orders list** (`/orders`):
   - **Backend:** `GET /orders` returns orders for the current customer.
2. User taps an order → **Order detail** (`/order/[id]`).
   - **Backend:** `GET /orders/:id` returns single order with store, address, items, `allowedTransitions`, `statusHistory`.

---

## 4.4 Order State Machine (Strict Status Control)

Order status transitions are **enforced in the backend**. Only valid transitions are allowed per role.

### Status enum
`PENDING` → `STORE_ACCEPTED` | `STORE_REJECTED` | `CANCELLED` → `READY_FOR_PICKUP` → `RIDER_ASSIGNED` → `RIDER_ACCEPTED` → `PICKED_UP` → `DELIVERED` | `CANCELLED`

### Who can change what

| Role | Transition | From → To |
|------|------------|-----------|
| **CUSTOMER** | Cancel | PENDING → CANCELLED |
| **STORE_OWNER** | Accept | PENDING → STORE_ACCEPTED |
| **STORE_OWNER** | Reject | PENDING → STORE_REJECTED |
| **STORE_OWNER** | Mark ready | STORE_ACCEPTED → READY_FOR_PICKUP |
| **ADMIN** | Assign rider | READY_FOR_PICKUP → RIDER_ASSIGNED (requires `riderId`) |
| **ADMIN** | Force cancel | Any (except DELIVERED/CANCELLED) → CANCELLED |
| **RIDER** | Accept | RIDER_ASSIGNED → RIDER_ACCEPTED |
| **RIDER** | Pick up | RIDER_ACCEPTED → PICKED_UP |
| **RIDER** | Deliver | PICKED_UP → DELIVERED |

### API
- **PATCH /orders/:id/status** with `{ status, riderId?, cancellationReason? }`
- Returns 400 if transition is invalid for current status/role
- **OrderStatusHistory** logs every change (`orderId`, `status`, `changedByUserId`, `createdAt`)

### UI
- **Store dashboard** (`/store/dashboard`): Tabs — Orders | Products | Earnings | Settings.
  - **Orders**: New (Accept/Reject), Preparing (Mark Ready), Ready for Pickup, Completed. Auto-refresh 15s.
  - **Products**: Categories CRUD, Products CRUD, stock toggle.
  - **Earnings**: Today summary, delivered orders list.
  - **Settings**: Store name, phone, address, hours, Open/Closed toggle.
- **Rider dashboard** (`/rider/dashboard`): Tabs — Dashboard | Earnings.
  - **Dashboard**: Online toggle, Today earnings & Completed. Active order card (Pickup/Drop, Map links, Accept/Reject or stage buttons). Assigned orders list (sorted: Accepted first, Assigned second).
  - **Earnings**: Today, This week, Total. Completed orders with per-order earning.
- **Rider order detail** (`/rider/orders/[id]`): Timeline, store/customer contact, map links, items, amount to collect, primary action.
- **Admin orders** (`/admin/orders`): List all orders. Assign rider for READY_FOR_PICKUP orders.

---

## 5. Customer Address Flow

**Routes:** `/addresses`, `/addresses/new`

1. User goes to **Delivery Address** (from More or Checkout).
2. **Backend:** `GET /users/me/addresses` returns addresses.
3. To add address: `/addresses/new`
   - User uses map to pick location (click or drag marker).
   - Reverse geocode fetches address (or uses coordinates if no API key).
   - User fills Label, Address, City.
   - User taps **Save Address**.
4. **Backend:** `POST /users/me/addresses` with `{ fullAddress, city, latitude, longitude, label, isDefault }`.

---

## 6. Admin Flow

### 🎯 Admin Dashboard Philosophy

Your admin panel is not for decoration. **It is the brain of Vybe.**

If something breaks in Lahore at 9PM — Admin should see it immediately.

### Admin Dashboard Structure (MVP – Fundraising Ready)

**Main Navigation** (sidebar layout, keep it clean):

- Dashboard
- Orders
- Stores
- Riders
- Partners (Invites)
- Users
- Finance
- Metrics
- Settings

---

### 🟢 6.1 Dashboard (Overview Page)

This is what you show investors live.

**Top KPI Cards** (from `GET /admin/metrics`):

- Total Orders Today
- Total Orders (All Time)
- Revenue Today (Platform Commission)
- Total Revenue
- Active Riders
- Active Stores
- Avg Delivery Time
- Cancellation Rate %

**Live Operations Section** (clickable cards):

- 🟡 Pending
- 🔵 Preparing
- 🟣 Ready for Pickup
- 🟢 Out for Delivery
- 🔴 Cancelled Today

Clicking a card → filter orders page.

**Alerts Section** (operationally serious):

- Stores currently closed during open hours
- Orders stuck in PENDING > 10 mins
- Orders stuck in READY_FOR_PICKUP > 15 mins
- Riders inactive > 2 hours

**Contribution Margin per Order** (investor widget):

- Avg Order, Commission, Service Fee, Rider Cost → Net per order

---

### 🟡 6.2 Orders Page

**Route:** `/admin/orders`

- **Table:** Order ID, Customer, Store, Rider, Status, Total, Commission, Delivery Time, Created At
- **Filters:** Status, Store, Rider, Date range
- **Actions:** Assign Rider (if READY_FOR_PICKUP), Force Cancel, View Details
- **Detail:** Full timeline (statusHistory), store earning, platform commission, cancellation reason, rider payout

---

### 🟣 6.3 Stores Page

**Route:** `/admin/stores`

- **List:** Store Name, Category, Orders Today, Revenue Today, Status (Open/Closed), Active/Inactive
- **Actions:** Activate/Deactivate, Edit commission %, View products, View store analytics
- **Detail:** Total orders, revenue, commission, avg preparation time, cancellation rate, opening hours, Toggle Active

---

### 🟠 6.4 Riders Page

**Route:** `/admin/riders`

- **Table:** Rider Name, Orders Today, Total Orders, Avg Delivery Time, Acceptance Rate %, Status (Online/Offline), Active/Inactive
- **Actions:** Activate/Deactivate, View order history, Manually assign order
- **Detail:** Earnings today/total, avg pickup time, delivery success rate, rejected orders

---

### 🔵 6.5 Partners (Invite System)

**Route:** `/admin/partners`

- **Columns:** Name, Role, Email, Phone, Active, Password Set?, Invite Expiry
- **Actions:** Create Invite, Resend Invite, Deactivate, Reset Password
- **Invite flow:** `/admin/partners/new` → Create & Get Invite Link

---

### 🟢 6.6 Users (Customers)

**Route:** `/admin/users`

- **Table:** Name, Phone, Orders Count, Total Spend, Status, Verified?
- **Actions:** Deactivate, View Order History, Flag for fraud

---

### 💰 6.7 Finance Page

**For investors:**

- **Today:** Gross GMV, Platform Commission (15%), Service Fees, Delivery Fees, Net Platform Revenue
- **This Month:** Total GMV, Total Commission, Total Cancellations loss
- **Export CSV:** Export Orders, Export Earnings

---

### 📈 6.8 Metrics Page (Investor Mode)

**Graphs (simple, minimal):**

- Orders per day (last 30 days)
- Revenue per day
- Avg delivery time trend
- Repeat customer %

---

### ⚙ 6.9 Settings Page

- Global commission %
- Service fee amount (23.49)
- Delivery fee amount
- OTP expiry duration
- Invite expiry duration
- Enable/disable crypto (Coming Soon toggle)

---

### 🧠 What NOT To Add (MVP)

- Role permission matrix editor
- Custom analytics builder
- Multi-city management
- Complex payout automation
- Manual wallet balance editing

**MVP = control, not ERP.**

---

### 🎯 What Makes This Investor-Ready

If you can open admin panel and show:

- 1,200 orders, 90 min avg delivery, 12% cancellation
- 15% commission auto-calculated, 200 repeat customers
- 35 active stores, 60 active riders

You look fundable.

---

### 6.10 Admin Login

1. Admin goes to `/auth/login`.
2. Enters `admin@vybe.pk` and password (e.g. `Admin123!` from seed).
3. **Backend:** `POST /auth/login` → returns JWT.
4. Frontend redirects to `/admin`.

### 6.11 Create Partner (Invite Flow)

1. Admin is on **Admin** (`/admin`).
2. **Backend:** `GET /admin/partners` returns all riders and store owners.
3. Admin taps **+ Invite Partner**.
4. Admin goes to **Invite Partner** (`/admin/partners/new`).
5. Admin fills: Name, Email (required), Phone, Role (RIDER or STORE_OWNER), Active.
6. Admin taps **Create & Get Invite Link**.
7. **Backend:** `POST /admin/partners`
   - Generates 32-byte hex `invitationToken`.
   - Sets `invitationExpiresAt` = now + 24 hours.
   - Creates user with `passwordSet: false`, `isVerified: true`.
   - Returns invite link: `{FRONTEND_URL}/partner-invite?token=...`
8. Admin copies link and sends it to the partner (email, WhatsApp, etc.).

---

## 7. Partner Invite Flow (Set Password)

**Route:** `/partner-invite?token=...`

1. Partner opens invite link.
2. Frontend reads `token` from query.
3. **Backend:** `POST /auth/validate-invite` with `{ token }`
   - Checks: token exists, not expired, `passwordSet === false`.
   - Returns `{ valid: true, name }` or `{ valid: false }`.
4. If **invalid or expired**: Shows "This invitation link is invalid or expired. Please contact admin."
5. If **valid**: Shows "Set Your Password" form.
6. Partner enters New Password + Confirm Password (min 8 chars, upper, lower, number).
7. Partner taps **Set Password & Continue**.
8. **Backend:** `POST /auth/set-password` with `{ token, password, confirmPassword }`
   - Hashes password, saves to user.
   - Sets `passwordSet: true`, clears `invitationToken`, `invitationExpiresAt`.
   - Returns JWT + user.
9. Frontend stores token and redirects by role:
   - `RIDER` → `/rider/dashboard`
   - `STORE_OWNER` → `/store/dashboard`

---

## 8. Partner Login Flow

**Route:** `/partner-login`

1. Partner enters email or phone + password.
2. Partner taps **Login**.
3. **Backend:** `POST /auth/partner-login` with `{ emailOrPhone, password }`
   - Finds user.
   - If role is `CUSTOMER` → error: "Please login using customer login."
   - If `passwordSet === false` → error: "Please set your password using the invitation link first."
   - If `isActive === false` → error: "Account is deactivated. Contact admin."
   - Verifies password, returns JWT.
4. Frontend redirects:
   - `RIDER` → `/rider/dashboard`
   - `STORE_OWNER` → `/store/dashboard`

**Note:** Seed store owner (`store@vybe.pk`) can also use `/auth/login` since they have `passwordSet: true`.

---

## 9. Role-Based Route Guards

| Role       | Can Access                         | Cannot Access                            |
|-----------|-------------------------------------|------------------------------------------|
| CUSTOMER  | /dashboard, /orders, /cart, /more, etc. | /admin, /rider/*, /store/*                |
| RIDER     | /rider/dashboard                    | /admin, /store/*, customer dashboard      |
| STORE_OWNER | /store/dashboard                 | /admin, /rider/*, customer dashboard     |
| ADMIN     | /admin, all partner routes          | -                                        |

- **Dashboard layout:** Redirects non-CUSTOMER to `/`.
- **Rider layout:** Redirects non-RIDER to `/`, unauthenticated to `/partner-login`.
- **Store layout:** Redirects non-STORE_OWNER to `/`, unauthenticated to `/partner-login`.
- **Admin layout:** Redirects non-ADMIN to `/`, unauthenticated to `/auth/login`.

---

## 10. Auth & Token Flow

1. **Token storage:** JWT stored in `localStorage` (`vybe_token`) and Zustand persist (`vybe_user`).
2. **API requests:** `api` service attaches `Authorization: Bearer <token>` to every request.
3. **401 response:** API interceptor removes token and dispatches `vybe_unauthorized`.
4. **AuthListener:** Listens for `vybe_unauthorized`, calls `logout()`, redirects to `/auth/login`.

---

## 11. OTP Flow (Customer)


- **Signup:** OTP sent after form submit. Code stored hashed in DB, expires in ~3 minutes.
- **Send:** Via `SMS_PROVIDER_URL` + `SMS_API_KEY` if configured; otherwise logged to backend console.
- **Verify:** `POST /auth/verify-otp` marks user as verified and returns JWT.

---

## 12. MVP Improvements (Business-Ready)

### Inventory control
- **Product:** `stock` (Decimal), `isOutOfStock` (boolean)
- **Order creation:** Validates stock for each item, reduces atomically in transaction
- **Insufficient stock:** Rejects order with clear message

### Commission logic
- **Platform commission:** 15% of subtotal (per pitch)
- **Store earning:** subtotal − commission
- **Platform earning:** commission (stored in `StoreEarning.commissionAmount`)

### Delivery & fees
- **Delivery fee:** 150 PKR (fixed)
- **Service fee:** Rs 23.49 per order (per pitch)
- **Total:** subtotal + deliveryFee + serviceFee
- **Delivery promise:** 90–120 minutes
- Checkout displays breakdown; payment intent uses full total

### Store open/closed
- **Store:** `openingTime`, `closingTime` (HH:mm)
- **isOpenNow:** Computed from current time vs opening/closing
- **UI:** Banner when closed; "Store closed – orders unavailable" disables ordering
- **Backend:** Rejects order creation when store is closed

### Rate limiting
- **Global:** 100 requests/min per IP (ThrottlerGuard)
- Protects OTP, login, invite validation, order creation

### Admin metrics (`GET /admin/metrics`)
- Total users, total orders, orders today
- Total revenue (platform commission)
- Active riders, active stores

### Cancellation
- **Enum:** CUSTOMER_CANCELLED, STORE_REJECTED, ADMIN_CANCELLED, OUT_OF_STOCK, STORE_CLOSED, OTHER
- **cancelledByRole:** Who cancelled (for analytics)
- Set automatically when status → CANCELLED or STORE_REJECTED

### Order timeline UI
- Order detail shows status history as progress steps (✔ with timestamps)
- Cancelled/rejected shown with ✕

---

## 13. API Endpoints Summary

| Method | Endpoint                | Auth | Purpose                     |
|--------|-------------------------|------|-----------------------------|
| POST   | /auth/signup            | No   | Create customer, send OTP   |
| POST   | /auth/login             | No   | Login (all roles)           |
| POST   | /auth/partner-login     | No   | Login (RIDER, STORE_OWNER)  |
| POST   | /auth/validate-invite   | No   | Validate invite token       |
| POST   | /auth/set-password      | No   | Set password from invite    |
| POST   | /auth/verify-otp        | No   | Verify OTP after signup     |
| POST   | /auth/login/request-otp | No   | Request OTP for login       |
| POST   | /auth/login/verify-otp   | No   | Verify OTP and login        |
| GET    | /users/me               | Yes  | Get profile                 |
| GET    | /users/me/addresses     | Yes  | List addresses              |
| POST   | /users/me/addresses     | Yes  | Create address              |
| GET    | /stores?category=...     | Yes  | List stores (optionally by food/grocery/medicine) |
| GET    | /stores/:id             | Yes  | Get store + products        |
| POST   | /orders                 | Yes  | Create order                |
| GET    | /orders                 | Yes  | List orders (by role)       |
| GET    | /orders/:id             | Yes  | Get single order            |
| POST   | /admin/partners         | Yes (Admin) | Create partner, get invite link |
| GET    | /admin/partners         | Yes (Admin) | List partners               |
| GET    | /admin/metrics          | Yes (Admin) | Dashboard metrics           |

---

## 14. Data Flow Diagram (Simplified)

```
[Customer] --> Signup --> OTP --> Dashboard --> Store --> Cart --> Checkout --> Order
                |                                                    |
                +--> Login (password) --------------------------------+

[Admin] --> Login --> Partners --> Invite Partner --> Copy link --> Send to partner

[Partner] --> Receive link --> /partner-invite --> Set password --> Auto-login --> Dashboard
              |
              +--> /partner-login (next time) --> Dashboard
```
