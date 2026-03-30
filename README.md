# Crossover Apparel

Production-ready full-stack web application for custom sportswear ordering and operations.

## Overview

Crossover Apparel is built with Next.js App Router and TypeScript, backed by Cloudflare services:

- Cloudflare D1 for relational data
- Cloudflare R2 for file storage
- Cloudflare Durable Objects + WebSockets for realtime updates

The system includes:

- Public storefront and guest checkout
- Admin dashboard and operations tools
- Designer panel for assigned order workflows
- Live updates for assignments, presence, and dashboard metrics

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn-style component architecture
- Framer Motion
- Recharts
- Zod
- Cloudflare Workers
- Cloudflare D1 (SQLite)
- Cloudflare R2
- Cloudflare Durable Objects (Realtime Hub)
- Wrangler 4

## Key Product Areas

### Public Website

- Home, Shop, Product details
- Custom Order flow
- Order Summary and Receipt
- Track Order by order number

### Owner Panel

- KPI dashboard (sales, orders, statuses)
- Orders management (status updates, assign staff, files)
- Product CRUD
- Category CRUD
- Staff management (create staff access, activate/deactivate)
- Reports (revenue history, staff performance)

### Staff Panel

- Staff login
- View assigned orders
- View order details and files
- Update order status
- Add notes
- View assignment history

### Realtime

- Staff online/offline presence updates
- Live dashboard refresh events
- Live order assignment and status updates

## Project Structure

```
app/
  (public)/
  (owner)/
  (staff)/
  api/
components/
  admin/
  site/
  ui/
db/
hooks/
lib/
services/
workers/
```

## Core Data Layer

- Schema: db/schema.sql
- D1 client types: db/client.ts
- Generic query helpers: db/query.ts
- Raw SQL helpers: db/raw.ts

## Service Layer

Business logic is centralized under services/:

- auth.service.ts
- order.service.ts
- upload.service.ts
- product.service.ts
- category.service.ts
- staff.service.ts
- staff-admin.service.ts
- designer.service.ts
- sales.service.ts
- dashboard.service.ts
- realtime-publisher.service.ts

## API Surface (Current)

### Public

- GET /api/health
- GET /api/products
- GET /api/categories
- POST /api/orders
- GET /api/orders/:orderNumber
- POST /api/uploads
- GET /api/realtime/config

### Auth

- POST /api/auth/owner/login
- POST /api/auth/staff/login
- GET /api/auth/me

Deprecated auth endpoints (return 410):
- POST /api/auth/admin/login
- POST /api/auth/designer/login

Customer storefront and ordering routes remain accessible without login.

### Owner

- GET /api/owner/dashboard
- GET /api/owner/sales
- GET /api/owner/reports

- GET /api/owner/orders
- POST /api/owner/orders/:orderId/assign-designer
- PATCH /api/owner/orders/:orderId/status
- PATCH /api/owner/orders/:orderId/notes

- POST /api/owner/products
- PATCH /api/owner/products/:id
- DELETE /api/owner/products/:id

- GET /api/owner/categories
- POST /api/owner/categories
- PATCH /api/owner/categories/:id
- DELETE /api/owner/categories/:id

- GET /api/owner/staff
- POST /api/owner/staff
- PATCH /api/owner/staff/:id/activation

### Staff

- GET /api/staff/orders
- GET /api/staff/orders/:orderNumber
- PATCH /api/staff/orders/:orderNumber/status
- PATCH /api/staff/orders/:orderNumber/notes

### Staff Presence

- POST /api/staff/presence

## Realtime Architecture

Realtime is implemented as a dedicated Cloudflare Worker with a Durable Object hub.

- Worker entry: workers/realtime-worker.ts
- Config: wrangler.realtime.toml
- Durable Object class: RealtimeHub

Endpoints:

- GET /health
- POST /publish (token protected)
- GET /ws?role=<admin|designer|staff>&userId=<optional>

### Event Flow

Application services publish events through services/realtime-publisher.service.ts.

Current event types include:

- assignment.updated
- order.status.updated
- order.note.added
- dashboard.updated
- staff.presence.updated

The Designer and Admin UIs subscribe through hooks/use-realtime.ts.

## Environment and Configuration

### Main app worker (wrangler.toml)

Required/used bindings and vars:

- DB (D1)
- ASSETS (R2)
- REALTIME_API_URL
- REALTIME_API_TOKEN

### Browser env

See .env.example:

- NEXT_PUBLIC_REALTIME_WS_URL=wss://<realtime-worker>/ws

### Realtime worker (wrangler.realtime.toml)

- Durable Object binding: REALTIME_HUB
- REALTIME_API_TOKEN

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start Next.js app:

```bash
npm run dev
```

3. Typecheck:

```bash
npm run typecheck
```

4. Build:

```bash
npm run build
```

## Database Setup (D1)

Apply schema to your D1 database:

```bash
npx wrangler d1 execute crossover_apparel --file db/schema.sql
```

If you use a remote DB, add --remote.

## Realtime Worker Deployment

Deploy dedicated realtime worker:

```bash
npx wrangler deploy -c wrangler.realtime.toml
```

Then set:

- wrangler.toml -> REALTIME_API_URL
- wrangler.toml -> REALTIME_API_TOKEN
- .env.local -> NEXT_PUBLIC_REALTIME_WS_URL

## Security Notes

- Role checks are enforced at API layer via auth guard.
- Password hashing is PBKDF2-based.
- Signed session token is used for auth state.
- Realtime publish endpoint is token protected.

## Current Status

- Public, Admin, and Designer apps are implemented.
- D1 schema and service-layer architecture are in place.
- Durable Object websocket realtime pipeline is integrated.
- Production build passes.
