# Capacity, limits, and scaling (VYBE Superapp)

## What “how many users” means

- **Registered accounts** are mostly a **database storage** question (Neon).
- **Concurrent users** means how many people can **actively use the app at the same time** (HTTP + WebSockets). That is limited mainly by **Railway (API)** and **Neon (Postgres)**, not by the Next.js PWA on Vercel (static/edge is rarely the first bottleneck).

There is **no single fixed number** (e.g. “exactly 500”) without **load testing** your deployed stack.

## Current stack (typical)

| Layer        | Role                                      | What limits you                          |
|-------------|--------------------------------------------|-------------------------------------------|
| **Vercel**  | PWA / Next.js frontend                    | High capacity for pages & assets          |
| **Railway** | NestJS API + Socket.IO                    | CPU, RAM, single instance, monthly usage  |
| **Neon**    | Postgres                                  | Storage, compute (CU-hours), connections  |
| **Geoapify**| Maps / geocoding                          | API quota on your plan                    |

## Ballpark expectations (not guarantees)

- **Tens of thousands of signups** over time is realistic for normal row sizes if Neon storage fits your plan (watch **0.5 GB** on Neon Free).
- **Concurrent active users** on a **small single Railway service + Neon Free** is often on the order of **tens** for chatty workloads, or more if most traffic is cached browsing and few API calls.
- To claim **hundreds** concurrent, you usually need **measured** load tests and often **paid** DB + **scaled** API.

## Real-time (Socket.IO)

- Orders use **Socket.IO** for **admin**, **store**, **rider**, and **customer** rooms.
- Clients also use **periodic HTTP refetch** as a fallback when sockets lag or disconnect.
- Scale-out note: multiple API instances require a **Redis (or compatible) adapter** for Socket.IO so all nodes share room state. A **single** Railway service does not need this.

## Gradual scaling checklist

1. **Measure** — Add Railway + Neon metrics; run **k6** or **Artillery** against staging/production API.
2. **Database** — Connection pooling (`PgBouncer` / Neon pooler), indexes on hot queries, avoid N+1.
3. **API** — Larger Railway plan or **horizontal replicas** behind a load balancer when CPU is saturated.
4. **Sockets** — Redis adapter for Socket.IO when running **more than one** API replica.
5. **Caches** — Short TTL cache for read-heavy public lists where safe.
6. **Maps** — Cache geocode results where possible; monitor Geoapify usage.

## What to tell stakeholders

> Capacity depends on hosting tiers and usage patterns. We design for growth (stateless API, pooled DB, realtime with fallback polling). Exact concurrent-user numbers should be validated with load tests before marketing a specific limit.
