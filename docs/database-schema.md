# Database Schema Blueprint

Primary source of truth: [prisma/schema.prisma](/C:/Users/RBT/Desktop/Ethio_Craft/prisma/schema.prisma)

## Identity and Access

- `users`: account identity, auth status, role (`CUSTOMER`, `ARTISAN`, `ADMIN`, `VERIFICATION_AGENT`)
- `artisans`: artisan profile metadata and verification status
- `addresses`: reusable shipping addresses for customers

## Catalog and Verification Workflow

- `product_drafts`: artisan draft workspace before listing goes live
- `products`: approved/published catalog entries
- `media`: product/draft/user media assets
- `reviews`: customer product feedback and ratings

## Orders and Payments

- `orders`: customer checkout records and status transitions
- `order_items`: per-product line items with artisan ownership
- `payments`: provider transactions (`TELEBIRR`, `CHAPA`, `SIMULATION`)
- `payment_webhook_events`: raw inbound webhook events, processing state, and linkage to payments

## Messaging, AI, and Reporting

- `chat_sessions`: user chatbot sessions and context
- `chat_messages`: conversation turns (`SYSTEM`, `USER`, `ASSISTANT`)
- `report_jobs`: generated analytics/report tasks and results

## Admin Operations

- `admin_audit_logs`: immutable operational action history
- `notifications`: in-app event notifications for users

## Placeholder Fields for Cultural Metadata and Future Extensions

The schema intentionally includes extensibility fields:

- `artisans.culturalMetadata` (`Json?`)
- `artisans.extensionData` (`Json?`)
- `product_drafts.culturalMetadata` (`Json?`)
- `product_drafts.extensionData` (`Json?`)
- `products.culturalMetadata` (`Json?`)
- `products.extensionData` (`Json?`)

Suggested `culturalMetadata` shape (example only):

```json
{
  "region": "Amhara",
  "craftTradition": "Tibeb weaving",
  "motifStory": "Represents harvest and unity",
  "language": "am",
  "intangibleHeritageTags": ["textile", "handloom"]
}
```

## Migration Notes

1. Run `npm run prisma:generate`
2. Run `npm run prisma:migrate -- --name ai_admin_payments_scaffold`
3. Re-run seed if needed: `npm run prisma:seed`
