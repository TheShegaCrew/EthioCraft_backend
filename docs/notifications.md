# Notification System Developer Guide

## Architecture Overview
The EthioCraft Notification System provides real-time, optimistic in-app alerts to all authenticated users (Customers, Artisans, Agents, and Admins). It uses a hook-based polling architecture on the frontend (`useNotifications`), synchronized with Prisma-backed state in the database.

## 1. Backend

### Schema
The `Notification` model is located in `schema.prisma`. It requires a `userId`, `title`, and `message`. It also features an optional JSON `metadata` field for storing contextual IDs (e.g., `orderId`, `sampleId`).

### Endpoints
* **User Reading:**
  * `GET /notifications/me` (Fetches current user's unread & read alerts)
  * `PATCH /notifications/:notificationId/read` (Marks a specific note as read)
* **Admin Dispatch:**
  * `POST /admin/users/:userId/notify`
    * Handled by `admin.service.notifyUser`.
    * Requires `title`, `message`, and optionally `type`.
    * Protected by `rateLimit` middleware (max 10 requests/min).
    * `title` and `message` strings are sanitized using the `xss` library before DB insertion to prevent Cross-Site Scripting.
  * `POST /admin/samples/:sampleId/re-verify`
    * Handled by `admin.service.reverifySample`.
    * Executes a Prisma `$transaction` to atomically update the sample status and issue an alert to the artisan.

## 2. Frontend

### The `useNotifications` Hook
Located at `hooks/useNotifications.ts`, this hook abstracts all API logic and provides an optimistic UI experience.

```typescript
const { 
  notifications, // Array of mapped ApiNotification objects
  unreadCount,   // Number of unread alerts
  markAsRead,    // Function to optimistically mark one as read
  markAllAsRead, // Function to optimistically mark all as read
  loading        // Boolean loading state
} = useNotifications({
  enabled: true, // Only fetch if the user is authenticated
});
```

**Polling Config:**
Polling interval defaults to 30,000ms. It can be overridden via the environment variable `NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL`.

### Security Guarantees
1. **XSS Protection:** Backend uses `xss` to sanitize payloads. Frontend React implicitly escapes text nodes.
2. **Rate Limiting:** Prevents spam from compromised admin accounts.
3. **RBAC:** Admin endpoints require the `ADMIN` JWT role.
4. **Audit Logging:** Every manual notification sent via `/admin/users/:userId/notify` or sample re-verification is recorded in the Admin Audit Logs.

## 3. Testing

### Backend Unit Tests
Run backend tests with `npm test`. 
See `src/modules/admin/admin.service.test.js` for mocks showing how Prisma `$transaction` and the XSS sanitization flow is verified.

### Frontend Unit Tests
Frontend hook tests use Jest and React Testing Library. 
See `hooks/useNotifications.test.ts` for optimistic update and rollback tests.
