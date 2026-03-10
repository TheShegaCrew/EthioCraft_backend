# API Reference

Base URL: `http://localhost:4000/api/v1`

Use bearer token for protected routes:

```http
Authorization: Bearer <jwt>
```

## Authentication

- `POST /auth/register`
- `POST /auth/login`

Sample register payload:

```json
{
  "firstName": "Marta",
  "lastName": "Haile",
  "email": "marta@example.com",
  "phone": "+251911000001",
  "password": "Password123!",
  "role": "ARTISAN",
  "artisanProfile": {
    "shopName": "Marta Woven Craft",
    "bio": "Traditional artisan basket maker",
    "region": "Addis Ababa",
    "city": "Addis Ababa"
  }
}
```

## User Management

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/me/addresses`
- `POST /users/me/addresses`
- `PATCH /users/me/addresses/:addressId`
- `DELETE /users/me/addresses/:addressId`

## Product Drafts, Verification, and Publishing

- `GET /artisan/products/drafts`
- `POST /artisan/products/drafts`
- `GET /artisan/products/drafts/:draftId`
- `PATCH /artisan/products/drafts/:draftId`
- `POST /artisan/products/drafts/:draftId/images`
- `POST /artisan/products/drafts/:draftId/submit`
- `PATCH /verifications/products/drafts/:draftId/review` (ADMIN, VERIFICATION_AGENT)
- `PATCH /admin/products/:productId/publish` (ADMIN)

Draft payload supports cultural placeholders:

```json
{
  "title": "Handwoven Mesob Basket",
  "description": "Colorful handwoven mesob basket crafted from natural fibers.",
  "category": "Baskets",
  "price": 1450,
  "stock": 12,
  "materials": ["Natural grass", "Cotton thread"],
  "tags": ["woven", "mesob", "tableware"],
  "dimensions": { "widthCm": 32, "heightCm": 24 },
  "culturalMetadata": {
    "region": "Amhara",
    "motifStory": "Traditional table ceremony piece"
  },
  "extensionData": {
    "futureField": null
  }
}
```

## Marketplace

- `GET /marketplace/products`
- `GET /marketplace/products/:productIdOrSlug`

Query params:

- `search`
- `category`
- `artisanId`
- `tag`
- `minPrice`
- `maxPrice`
- `sortBy` (`newest`, `oldest`, `price_asc`, `price_desc`)
- `page`
- `limit`

## Orders

- `POST /orders`
- `GET /orders`
- `GET /orders/:orderId`
- `GET /orders/:orderId/tracking`
- `PATCH /orders/:orderId/status`

## Payments (TeleBirr, Chapa, Simulation)

Protected routes:

- `POST /payments/initialize`
- `GET /payments/:paymentId`
- `POST /payments/:paymentId/confirm`

Public provider webhooks:

- `POST /payments/webhooks/telebirr`
- `POST /payments/webhooks/chapa`

Initialize payload:

```json
{
  "orderId": "clx-order-1",
  "provider": "TELEBIRR"
}
```

Confirm payload:

```json
{
  "status": "SUCCESS",
  "txRef": "TELEBIRR-1710000000000-abc123",
  "providerReference": "TB-REF-123"
}
```

## Notifications

- `GET /notifications/me`
- `PATCH /notifications/:notificationId/read`

## AI Chatbot APIs

- `GET /ai/chat/sessions`
- `POST /ai/chat/sessions`
- `GET /ai/chat/sessions/:sessionId`
- `POST /ai/chat/sessions/:sessionId/messages`

Create session payload:

```json
{
  "title": "Order help",
  "context": {
    "language": "en",
    "channel": "web"
  }
}
```

Create message payload:

```json
{
  "message": "How do I track my order?"
}
```

## AI Reporting APIs

- `POST /ai/reports/jobs` (ADMIN, VERIFICATION_AGENT, ARTISAN)
- `GET /ai/reports/jobs` (ADMIN, VERIFICATION_AGENT, ARTISAN)
- `GET /ai/reports/jobs/:jobId` (ADMIN, VERIFICATION_AGENT, ARTISAN)

Report types:

- `SALES_SUMMARY`
- `ORDER_PERFORMANCE`
- `PRODUCT_VERIFICATION`
- `ARTISAN_PERFORMANCE`

Create report payload:

```json
{
  "type": "SALES_SUMMARY",
  "filters": {
    "dateFrom": "2026-01-01T00:00:00.000Z",
    "dateTo": "2026-01-31T23:59:59.999Z",
    "artisanId": "optional_for_admin"
  }
}
```

## Admin Dashboard APIs

All routes below require `ADMIN` role.

- `GET /admin/dashboard/overview`
- `GET /admin/dashboard/revenue`
- `GET /admin/dashboard/verifications`
- `GET /admin/dashboard/orders`
- `GET /admin/dashboard/artisans/top`
- `GET /admin/audit-logs`

Common query params:

- `dateFrom` (ISO datetime)
- `dateTo` (ISO datetime)
- `limit`
- `page` (for audit logs)

## Health Check

- `GET /health`

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-03-09T09:00:00.000Z",
  "service": "ethiopian-handcraft-marketplace-api"
}
```
