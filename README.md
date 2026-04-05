# Crossover Apparel

Production-ready full-stack web application for custom sportswear ordering and operations.

Live: https://crossoverapparel.shop

## Overview

Crossover Apparel is built with Next.js App Router and TypeScript, deployed on Cloudflare Workers via OpenNext. The platform covers the full lifecycle of a custom sportswear order — from storefront browsing and checkout through internal designer workflows and admin reporting.

**Three user-facing apps in one deployment:**

- **Public storefront** — product browsing, multiple order flows, payment, tracking
- **Admin panel** — KPI dashboard, order management, staff, products, categories, reports
- **Designer panel** — assigned orders, status updates, notes, history, commission tracking

## Tech Stack

| Area | Technology |
|------|-----------|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn-style (Radix UI primitives) |
| Animations | Framer Motion |
| Charts | Recharts |
| Validation | Zod |
| Runtime | Cloudflare Workers (via @opennextjs/cloudflare) |
| Database | Cloudflare D1 (SQLite) |
| File Storage | Cloudflare R2 |
| Realtime | Cloudflare Durable Objects + hibernatable WebSockets |
| Deployment | Wrangler 4 |

## Key Product Areas

### Public Storefront

- Homepage with featured products, testimonials, and banners
- Product catalog with category filtering
- **Three order flows:**
  - **Product Order** (`/product-order/[productId]`) — standard configurable product order
  - **Exclusive Order** (`/exclusive-order/[productId]`) — premium/exclusive product order
  - **Custom Order** (`/custom-order`) — fully custom design request
- Order Summary page with payment selection
- Receipt page
- **Track Order** (`/track-order`) — live status polling with real-time updates
- Customer login

### Payment Methods

- **Lightning Network** — BTC Lightning invoice with QR code, rate conversion, and confirmation flow
- **InstaPay** — manual QR payment with required receipt upload
- Both manual payment methods require receipt upload before submission

### Admin Panel (`/admin`)

- KPI dashboard (revenue, orders, pending, in-production, delivered counts)
- Notification bell — real-time alerts for new orders and designer status changes
- **Orders** — list, filter by status, assign designer, update status, add notes, view files/receipts
- **Products** — create, edit, archive, image upload
- **Categories** — hierarchical category management
- **Staff** — create designer accounts, activate/deactivate, view last seen
- **Reports** — sales history, designer performance, order status breakdown, category revenue, monthly trends, top customers

### Designer Panel (`/designer`)

- Notification bell — real-time alerts for new assignments and admin status changes
- Dashboard with assigned and recent orders
- **Order detail** — full order info, files, customizations, status update, notes
- **History** — completed/delivered order history
- Commission tracking

### Realtime

- Hibernatable WebSocket Durable Object (`PresenceHub`) for persistent connections
- Session metadata persisted via `serializeAttachment` / `deserializeAttachment` (survives DO hibernation)
- Designer online/offline/break presence
- Live notifications for order assignments and status changes
- Event bus: `assignment.updated`, `order.status.updated`, `order.note.added`, `dashboard.updated`, `staff.presence.updated`

## Order Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Order placed, awaiting confirmation |
| `confirmed` | Order confirmed by admin |
| `in_production` | Designer is producing the order |
| `ready_to_ship` | Production complete |
| `shipped` | Order dispatched |
| `delivered` | Order received by customer |
| `cancelled` | Order cancelled |
| `payment_failed` | Payment not received / failed |

## Project Structure

```
app/
  (public)/          Public storefront routes
  (admin)/           Admin panel routes
  (designer)/        Designer panel routes
  api/               All API route handlers
components/
  admin/             Admin-specific UI components
  site/              Storefront layout components
  ui/                Shared primitives (Button, Input, Card, etc.)
  notification-bell.tsx
  lightning-payment.tsx
  instapay-payment.tsx
  product-card.tsx
db/
  schema.sql         D1 database schema
  client.ts          D1 binding types
  query.ts           Generic query helpers
  raw.ts             Raw SQL helpers
hooks/
  use-api.ts
  use-realtime.ts
  use-presence.ts
lib/
  format.ts          formatDate (GMT+8 / Asia/Manila), formatCurrency
  types.ts           Shared TypeScript types
  auth/              JWT guard, password (PBKDF2), token signing
  durable-objects/   PresenceHub Durable Object implementation
  realtime/          Client-side presence WebSocket helper
services/            Business logic layer (one file per domain)
workers/
  realtime-worker.ts Standalone realtime Cloudflare Worker
presence-hub-api/    Separate Wrangler project for PresenceHub development/testing
```

## API Surface

### Public (no auth)

```
GET  /api/health
GET  /api/products
GET  /api/categories
GET  /api/payment-methods
POST /api/testimonials
GET  /api/realtime/config
GET  /api/products/images/[...key]

POST /api/orders
GET  /api/orders/[orderNumber]
POST /api/orders/[orderNumber]/confirm-payment
POST /api/orders/[orderNumber]/lightning-invoice
POST /api/orders/[orderNumber]/payment-receipt
POST /api/orders/[orderNumber]/cancel
POST /api/orders/[orderNumber]/rating
GET  /api/orders/files/[...key]
GET  /api/orders/payment-receipts/[...key]

POST /api/uploads
POST /api/presence
```

### Auth

```
POST /api/auth/admin/login
POST /api/auth/designer/login
POST /api/auth/staff/login
POST /api/auth/logout
GET  /api/auth/me
```

### Admin (requires admin session)

```
GET  /api/admin/dashboard
GET  /api/admin/sales
GET  /api/admin/reports
GET  /api/admin/commissions

GET    /api/admin/orders
PATCH  /api/admin/orders/[orderId]/status
PATCH  /api/admin/orders/[orderId]/notes
POST   /api/admin/orders/[orderId]/assign-designer

GET    /api/admin/products
POST   /api/admin/products
PATCH  /api/admin/products/[id]
DELETE /api/admin/products/[id]
POST   /api/admin/products/[id]/image

GET    /api/admin/categories
POST   /api/admin/categories
PATCH  /api/admin/categories/[id]
DELETE /api/admin/categories/[id]

GET    /api/admin/payment-methods
PATCH  /api/admin/payment-methods/[id]

GET  /api/admin/staff
POST /api/admin/staff
PUT  /api/admin/staff/[id]/password
POST /api/admin/staff/[id]/activation

POST /api/admin/seed  (database migration / seeding)
```

### Designer (requires designer session)

```
GET   /api/designer/orders
GET   /api/designer/orders/[orderNumber]
PATCH /api/designer/orders/[orderNumber]/status
PATCH /api/designer/orders/[orderNumber]/notes
POST  /api/designer/presence
GET   /api/designer/commission
```

## Realtime Architecture

Realtime uses a standalone Cloudflare Worker (`workers/realtime-worker.ts`) with a Durable Object (`PresenceHub`) for WebSocket connection management.

```
App services  →  realtime-publisher.service.ts  →  POST /publish  →  PresenceHub
                                                                          │
                                          Admin/Designer UI  ←  WebSocket │
```

**PresenceHub** (`lib/durable-objects/presence-hub.ts`):
- Hibernatable WebSocket API — connections survive Durable Object sleep
- `serializeAttachment()` persists `role` and `userId` per connection through hibernation
- `state.getWebSockets()` used in all broadcast methods to retrieve live connections after wake
- Separate broadcast channels by role (`owner`, `designer`, `staff`)

### Realtime Worker Endpoints

```
GET  /health
POST /publish         (REALTIME_API_TOKEN required)
GET  /ws?role=<role>&userId=<optional>
```

## Data Flow — Timezone

All timestamps are stored as UTC in D1 (`CURRENT_TIMESTAMP`). Display-side conversion to **GMT+8 (Asia/Manila)** is handled by `lib/format.ts`:

```ts
formatDate(value)  // → "Apr 5, 2026, 8:00 AM" in Asia/Manila time
```

Deadline date `min` inputs also use `{ timeZone: "Asia/Manila" }` for accurate local date calculation.

## Environment and Configuration

### Wrangler bindings (`wrangler.toml`)

| Binding | Type | Resource |
|---------|------|----------|
| `DB` | D1 | crossover-apparel-db |
| `PRODUCT_IMAGES` | R2 | crossover-product-images |
| `ORDER_FILES` | R2 | crossover-order-files |
| `PAYMENT_RECEIPTS` | R2 | crossover-payment-receipts |
| `PRESENCE_HUB` | Durable Object | PresenceHub |
| `ASSETS` | Static Assets | .open-next/assets |

### Secrets (set via `wrangler secret put`)

- `AUTH_SECRET` — JWT signing key
- `REALTIME_API_TOKEN` — shared secret between app and realtime worker
- `SEED_KEY` — protects the `/api/admin/seed` migration endpoint

### Environment Variables

```toml
APP_NAME = "Crossover Apparel"
APP_ENV  = "production"
REALTIME_API_URL = "https://..."   # URL of realtime worker
```

```env
# .env.local
NEXT_PUBLIC_REALTIME_WS_URL=wss://<realtime-worker>/ws
```

### Realtime worker (`wrangler.realtime.toml`)

Separate config file for the realtime worker. Requires:
- Durable Object binding: `REALTIME_HUB → PresenceHub`
- Secret: `REALTIME_API_TOKEN`

## Local Development

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
# Full production deploy
npm run deploy

# Preview locally with Wrangler
npm run preview

# Type check only
npm run typecheck
```

Deploy command runs: `next build → opennextjs-cloudflare build → wrangler deploy`

## Database Setup

Apply schema to D1:

```bash
npx wrangler d1 execute crossover-apparel-db --file db/schema.sql --remote
```

Run migrations / seed via the protected endpoint after deploy:

```
POST /api/admin/seed
x-seed-key: <SEED_KEY>
```

## Security

- API routes protected by role-checked session tokens (signed with `AUTH_SECRET`)
- Passwords hashed with PBKDF2 (Web Crypto API)
- Realtime publish endpoint requires `REALTIME_API_TOKEN` bearer token
- R2 file access proxied through API routes — buckets are not public
- `SEED_KEY` required for all destructive migration operations
