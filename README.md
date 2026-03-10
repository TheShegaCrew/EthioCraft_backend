# Ethiopian Handcraft Marketplace Backend

Backend-first REST API for an Ethiopian artisan marketplace built with Express, PostgreSQL, Prisma, JWT auth, and optional Redis caching.

## Core stack

- Node.js + Express.js
- PostgreSQL
- Prisma ORM
- JWT authentication
- Optional Redis caching for marketplace reads
- REST API with role-based access control

## Roles

- Customer
- Artisan
- Admin
- Verification Agent

## Implemented domains

- Authentication and role-based access control
- Artisan profile and address management
- Product draft submission, verification workflow, and publishing
- Marketplace search and product detail APIs
- Order lifecycle and tracking
- TeleBirr/Chapa/simulation payment scaffolding with webhook ingestion
- AI chatbot session/message APIs
- AI reporting job APIs
- Admin dashboard analytics and audit log APIs
- Notification center

## Database design

Primary schema: [prisma/schema.prisma](/C:/Users/RBT/Desktop/Ethio_Craft/prisma/schema.prisma)

Design docs:

- Database blueprint: [docs/database-schema.md](/C:/Users/RBT/Desktop/Ethio_Craft/docs/database-schema.md)
- API reference: [docs/api-reference.md](/C:/Users/RBT/Desktop/Ethio_Craft/docs/api-reference.md)
- Deployment strategy: [docs/deployment-strategy.md](/C:/Users/RBT/Desktop/Ethio_Craft/docs/deployment-strategy.md)
- Postman guide: [docs/postman-testing.md](/C:/Users/RBT/Desktop/Ethio_Craft/docs/postman-testing.md)

## Setup

1. Copy `.env.example` to `.env`
2. Start dependencies: `docker compose up -d`
3. Install dependencies: `npm install`
4. Generate Prisma client: `npm run prisma:generate`
5. Apply migrations: `npm run prisma:migrate -- --name init`
6. Seed sample data: `npm run prisma:seed`
7. Start API: `npm run dev`

## Seed accounts

All seeded accounts use password `Password123!`.

- Admin: `admin@ethiocraft.com`
- Verification Agent: `agent@ethiocraft.com`
- Artisan: `artisan@ethiocraft.com`
- Customer: `customer@ethiocraft.com`

## Key extension placeholders

Schema supports future expansion via JSON fields:

- `artisans.culturalMetadata`
- `artisans.extensionData`
- `product_drafts.culturalMetadata`
- `product_drafts.extensionData`
- `products.culturalMetadata`
- `products.extensionData`

Use these fields for cultural lineage, motif stories, language metadata, and future AI enrichment pipelines.

## Scripts

- `npm run dev`
- `npm run start`
- `npm run check:syntax`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`
