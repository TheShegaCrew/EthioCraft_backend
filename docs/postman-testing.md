# Postman Testing Workflow

## 1. Start the backend dependencies

1. Run `docker compose up -d`.
2. Copy `.env.example` to `.env`.
3. Run `npm install`.
4. Run `npm run prisma:generate`.
5. Run `npm run prisma:migrate -- --name init`.
6. Run `npm run prisma:seed`.
7. Run `npm run dev`.

Health check:

- Method: `GET`
- URL: `http://localhost:4000/health`

Expected response:

```json
{
  "status": "ok",
  "service": "ethiopian-handcraft-marketplace-api"
}
```

## 2. Create a Postman environment

Recommended variables:

- `baseUrl` = `http://localhost:4000/api/v1`
- `customerEmail` = `customer@ethiocraft.com`
- `artisanEmail` = `artisan@ethiocraft.com`
- `adminEmail` = `admin@ethiocraft.com`
- `agentEmail` = `agent@ethiocraft.com`
- `password` = `Password123!`
- `customerToken`
- `artisanToken`
- `adminToken`
- `agentToken`
- `draftId`
- `productId`
- `orderId`
- `paymentId`
- `notificationId`
- `addressId`

## 3. Authenticate each role

Create four `POST {{baseUrl}}/auth/login` requests and log in as:

- customer
- artisan
- admin
- verification agent

Body:

```json
{
  "email": "{{customerEmail}}",
  "password": "{{password}}"
}
```

Save the returned `data.token` into the matching Postman environment variable.

## 4. Test the user module

1. Call `GET {{baseUrl}}/users/me` with the customer token.
2. Call `GET {{baseUrl}}/users/me/addresses` and copy the seeded `addressId`.
3. Call `POST {{baseUrl}}/users/me/addresses` to add a second address.
4. Call `PATCH {{baseUrl}}/users/me/addresses/:addressId` to verify updates.

## 5. Test the artisan draft workflow

1. Use artisan token.
2. Create a draft with `POST {{baseUrl}}/artisan/products/drafts`.
3. Save the returned `draftId`.
4. Upload images with `POST {{baseUrl}}/artisan/products/drafts/{{draftId}}/images`.
5. In Postman choose `form-data` and attach files using the field name `images`.
6. Submit the draft with `POST {{baseUrl}}/artisan/products/drafts/{{draftId}}/submit`.

## 6. Test verification and publishing

1. Use the verification agent token.
2. Review the submitted draft with `PATCH {{baseUrl}}/verifications/products/drafts/{{draftId}}/review`.
3. If approved, copy `data.product.id` into `productId`.
4. Switch to admin token.
5. Publish using `PATCH {{baseUrl}}/admin/products/{{productId}}/publish`.

## 7. Test the marketplace

1. Call `GET {{baseUrl}}/marketplace/products` without any token.
2. Call `GET {{baseUrl}}/marketplace/products/{{productId}}`.
3. Try filters like:
   - `{{baseUrl}}/marketplace/products?search=mesob`
   - `{{baseUrl}}/marketplace/products?category=Baskets`
   - `{{baseUrl}}/marketplace/products?sortBy=price_desc`

## 8. Test ordering

1. Use customer token.
2. Create an order with `POST {{baseUrl}}/orders`.
3. Save `data.id` as `orderId`.
4. Verify order history with `GET {{baseUrl}}/orders`.
5. Verify tracking with `GET {{baseUrl}}/orders/{{orderId}}/tracking`.

## 9. Test payment simulation

1. Initialize payment with `POST {{baseUrl}}/payments/initialize`.
2. Save `data.payment.id` as `paymentId`.
3. Copy `data.payment.txRef`.
4. Confirm payment with `POST {{baseUrl}}/payments/{{paymentId}}/confirm`.

Successful confirmation body:

```json
{
  "status": "SUCCESS",
  "txRef": "<copied from initialize response>"
}
```

Failed confirmation body:

```json
{
  "status": "FAILED",
  "txRef": "<copied from initialize response>"
}
```

## 10. Test order progression and notifications

1. Use artisan or admin token.
2. Update the paid order with `PATCH {{baseUrl}}/orders/{{orderId}}/status` and body `{ "status": "PROCESSING" }`.
3. Update it again to `{ "status": "SHIPPED" }`.
4. Switch back to customer token.
5. Call `GET {{baseUrl}}/notifications/me`.
6. Copy a notification id and mark it read with `PATCH {{baseUrl}}/notifications/:notificationId/read`.

## 11. Optional curl smoke tests

Login:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@ethiocraft.com","password":"Password123!"}'
```

Marketplace list:

```bash
curl http://localhost:4000/api/v1/marketplace/products
```

## Notes

- The backend is fully testable without any frontend.
- Image upload requires multipart form-data and one or more `images` file fields.
- Redis is optional. Leave `CACHE_ENABLED=false` if you want to skip it.
- Payment integration is intentionally simulated so the rest of the order workflow can be validated before real Telebirr or Chapa integration.
