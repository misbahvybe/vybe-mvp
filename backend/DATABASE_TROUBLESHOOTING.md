# Database Connection Troubleshooting

## Error: "Can't reach database server at ep-late-bonus-aivxf3k2-pooler..."

Your app uses **Neon** (PostgreSQL). The connection fails when:

---

## 1. Neon project is paused (most common)

Neon free tier **pauses** databases after ~5 minutes of inactivity.

**Fix:**
1. Go to [console.neon.tech](https://console.neon.tech)
2. Open your project
3. If you see "Resume" or "Project paused" → click **Resume**
4. Wait 30 seconds, then run `npx prisma db seed` again

---

## 2. Wrong or expired `DATABASE_URL`

**Fix:**
1. Go to [console.neon.tech](https://console.neon.tech) → your project
2. Click **Connection Details** or **Dashboard**
3. Copy the **connection string** (Pooled connection recommended)
4. Ensure it ends with: `?sslmode=require`
5. Update `backend/.env`:
   ```
   DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
   ```

---

## 3. Firewall / network blocking port 5432

- Corporate or school networks may block PostgreSQL port 5432
- Try from a different network (e.g. mobile hotspot)
- Or use Neon's connection pooler (port 5432 with `-pooler` hostnames usually works better)

---

## 4. Use local PostgreSQL instead

If Neon keeps failing, switch to a local database:

1. Install PostgreSQL locally (or use Docker)
2. Create a database named `vybe`
3. In `backend/.env`:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/vybe"
   ```
4. Run: `npx prisma migrate dev` or `npx prisma db push`
5. Run: `npx prisma db seed`

---

## After fixing the database

1. Restart your backend: `npm run start:dev`
2. Run seed: `npx prisma db seed`
3. Try logging in with:
   - Admin: `admin@vybe.pk` / `Admin123!`
   - Store: `store@vybe.pk` / `Store123!`
