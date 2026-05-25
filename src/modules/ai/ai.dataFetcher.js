/**
 * ai.dataFetcher.js
 *
 * Fetches live marketplace data from the database based on the authenticated
 * user's role and the detected intent of their message.
 *
 * Design principles:
 *  - Every fetch is wrapped in try/catch so a Prisma failure returns a graceful
 *    fallback message instead of crashing the AI response.
 *  - Data is scoped strictly to what the user's role is allowed to see.
 *  - All formatted output clearly labels "Sample Status:" vs "Draft Status:"
 *    so the LLM never conflates the two concepts.
 *  - If a table/endpoint is missing or empty, a "not available" message is
 *    returned rather than an empty string or an exception.
 */

const prisma = require('../../config/prisma');

const UNAVAILABLE = 'This data is not available in the marketplace service right now.';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatProducts(products) {
  if (!products || products.length === 0) return 'No published products found.';
  return products
    .slice(0, 10)
    .map((p) => {
      const artisanName = p.artisan
        ? `${p.artisan.firstName} ${p.artisan.lastName}`
        : 'Unknown';
      return `• [${p.title}] — ${p.price} ${p.currency} | Category: ${p.category} | Stock: ${p.stock} | Artisan: ${artisanName} | Status: ${p.status}`;
    })
    .join('\n');
}

function formatOrders(orders) {
  if (!orders || orders.length === 0) return 'No orders found.';
  return orders
    .slice(0, 10)
    .map((o) => {
      const itemSummary = o.items
        ? o.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')
        : '';
      return `• Order #${o.id.slice(-8).toUpperCase()} | Status: ${o.status} | Total: ${o.totalAmount} ${o.currency} | Items: ${itemSummary} | Placed: ${new Date(o.createdAt).toLocaleDateString()}`;
    })
    .join('\n');
}

function formatDrafts(drafts) {
  if (!drafts || drafts.length === 0) return 'No product drafts found.';
  return drafts
    .slice(0, 10)
    .map((d) => {
      const reviewer = d.reviewer
        ? `${d.reviewer.firstName} ${d.reviewer.lastName}`
        : 'Unassigned';
      return `• "${d.title}" | Draft Status: ${d.status} | Category: ${d.category} | Price: ${d.price} ${d.currency} | Reviewer: ${reviewer} | Notes: ${d.verificationNotes || d.submissionNotes || 'None'}`;
    })
    .join('\n');
}

function formatSamples(samples) {
  if (!samples || samples.length === 0) return 'No samples found.';
  return samples
    .slice(0, 10)
    .map((s) => {
      const verifier = s.assignedVerifier
        ? `${s.assignedVerifier.firstName} ${s.assignedVerifier.lastName}`
        : 'Unassigned';
      return `• "${s.title}" | Sample Status: ${s.status} | Category: ${s.category || 'N/A'} | Verifier: ${verifier} | Notes: ${s.submissionNotes || 'None'} | Submitted: ${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : 'N/A'}`;
    })
    .join('\n');
}

function formatCartItems(items) {
  if (!items || items.length === 0) return 'Your cart is empty.';
  const total = items.reduce(
    (sum, i) => sum + Number(i.product?.price || 0) * i.quantity,
    0
  );
  const lines = items
    .map(
      (i) =>
        `• ${i.product?.title || 'Unknown product'} — Qty: ${i.quantity} | Price: ${i.product?.price} ${i.product?.currency || 'ETB'}`
    )
    .join('\n');
  return `${lines}\n\nEstimated Total: ${total.toFixed(2)} ETB`;
}

function formatAuditLogs(logs) {
  if (!logs || logs.length === 0) return 'No audit log entries found.';
  return logs
    .slice(0, 15)
    .map((log) => {
      const actor = log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`
        : 'System';
      return `• [${new Date(log.createdAt).toLocaleString()}] ${log.action} on ${log.entityType}${log.entityId ? ` #${log.entityId.slice(-8).toUpperCase()}` : ''} by ${actor} — ${log.description}`;
    })
    .join('\n');
}

function formatUsers(users) {
  if (!users || users.length === 0) return 'No users found.';
  return users
    .slice(0, 15)
    .map(
      (u) =>
        `• ${u.firstName} ${u.lastName} | Role: ${u.role} | Status: ${u.status} | Email: ${u.email}`
    )
    .join('\n');
}

// ─── Role-Scoped Fetchers ─────────────────────────────────────────────────────

async function fetchProducts(user) {
  try {
    const where =
      user.role === 'ARTISAN'
        ? { artisanId: user.id, status: { in: ['APPROVED', 'PUBLISHED'] } }
        : { status: 'PUBLISHED' };

    const products = await prisma.product.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        artisan: { select: { firstName: true, lastName: true } },
      },
    });
    return { label: 'Products', text: formatProducts(products) };
  } catch {
    return { label: 'Products', text: UNAVAILABLE };
  }
}

async function fetchOrders(user) {
  try {
    const where =
      user.role === 'ADMIN'
        ? {}
        : { customerId: user.id };

    const orders = await prisma.order.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { select: { productName: true, quantity: true } },
      },
    });
    return { label: 'Orders', text: formatOrders(orders) };
  } catch {
    return { label: 'Orders', text: UNAVAILABLE };
  }
}

async function fetchDrafts(user) {
  try {
    const where =
      user.role === 'ARTISAN'
        ? { artisanId: user.id }
        : {};

    const drafts = await prisma.productDraft.findMany({
      where,
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        reviewer: { select: { firstName: true, lastName: true } },
      },
    });
    return { label: 'Product Drafts', text: formatDrafts(drafts) };
  } catch {
    return { label: 'Product Drafts', text: UNAVAILABLE };
  }
}

async function fetchSamples(user) {
  try {
    const where =
      user.role === 'ARTISAN'
        ? { artisanId: user.id }
        : user.role === 'VERIFICATION_AGENT'
        ? { assignedVerifierId: user.id }
        : {};

    const samples = await prisma.sample.findMany({
      where,
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedVerifier: { select: { firstName: true, lastName: true } },
      },
    });
    return { label: 'Samples', text: formatSamples(samples) };
  } catch {
    return { label: 'Samples', text: UNAVAILABLE };
  }
}

async function fetchCart(user) {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        product: {
          select: { title: true, price: true, currency: true, stock: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { label: 'Cart', text: formatCartItems(items) };
  } catch {
    return { label: 'Cart', text: UNAVAILABLE };
  }
}

async function fetchAuditLogs() {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { firstName: true, lastName: true } },
      },
    });
    return { label: 'Admin Audit Logs', text: formatAuditLogs(logs) };
  } catch {
    return { label: 'Admin Audit Logs', text: UNAVAILABLE };
  }
}

async function fetchUsers() {
  try {
    const users = await prisma.user.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
      },
    });
    return { label: 'Users', text: formatUsers(users) };
  } catch {
    return { label: 'Users', text: UNAVAILABLE };
  }
}

// ─── Access Guard ─────────────────────────────────────────────────────────────

const ROLE_PERMISSION = {
  // [intent]: Set of allowed roles (null means all)
  ORDER_ASSISTANCE: ['ADMIN', 'CUSTOMER'],
  PAYMENT_ASSISTANCE: ['ADMIN', 'CUSTOMER'],
  CART_HELP: ['ADMIN', 'CUSTOMER'],
  DRAFT_STATUS: ['ADMIN', 'VERIFICATION_AGENT', 'ARTISAN'],
  SAMPLE_STATUS: ['ADMIN', 'VERIFICATION_AGENT', 'ARTISAN'],
  PRODUCT_HELP: ['ADMIN', 'VERIFICATION_AGENT', 'ARTISAN', 'CUSTOMER'],
  ADMIN_OVERVIEW: ['ADMIN'],
  ACCOUNT_HELP: ['ADMIN', 'VERIFICATION_AGENT', 'ARTISAN', 'CUSTOMER'],
};

function isAllowed(role, intent) {
  const allowed = ROLE_PERMISSION[intent];
  if (!allowed) return true; // GREETING, PLATFORM_INFO, GENERAL_SUPPORT — open
  return allowed.includes(role);
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Fetches relevant marketplace context for a given user + intent.
 *
 * @param {object} user   - Authenticated user { id, role, email }
 * @param {string} intent - Classified intent label
 * @returns {Promise<string>} - A formatted multi-section string to inject into the prompt
 */
async function fetchContextForUser(user, intent) {
  const role = user.role;

  // Access check – return access-denied note (no hard throw – keeps chat alive)
  if (!isAllowed(role, intent)) {
    return `[Access Restricted] You do not have permission to view ${intent.toLowerCase().replace(/_/g, ' ')} data.`;
  }

  const sections = [];

  // Dispatch based on intent
  switch (intent) {
    case 'PRODUCT_HELP': {
      const result = await fetchProducts(user);
      sections.push(`**${result.label}:**\n${result.text}`);
      break;
    }

    case 'ORDER_ASSISTANCE': {
      const result = await fetchOrders(user);
      sections.push(`**${result.label}:**\n${result.text}`);
      break;
    }

    case 'PAYMENT_ASSISTANCE': {
      // Fetch orders + payment status
      try {
        const orders =
          role === 'ADMIN'
            ? await prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                  payments: {
                    select: { provider: true, status: true, amount: true, createdAt: true },
                  },
                  items: { select: { productName: true } },
                },
              })
            : await prisma.order.findMany({
                where: { customerId: user.id },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                  payments: {
                    select: { provider: true, status: true, amount: true, createdAt: true },
                  },
                  items: { select: { productName: true } },
                },
              });

        const text = orders.length === 0
          ? 'No payment records found.'
          : orders
              .map((o) => {
                const payLines = o.payments.map(
                  (p) =>
                    `  → Payment via ${p.provider}: ${p.status} | Amount: ${p.amount} ETB | Date: ${new Date(p.createdAt).toLocaleDateString()}`
                ).join('\n');
                return `• Order #${o.id.slice(-8).toUpperCase()} — ${o.items.map((i) => i.productName).join(', ')}\n${payLines || '  → No payments recorded'}`;
              })
              .join('\n');

        sections.push(`**Payment Details:**\n${text}`);
      } catch {
        sections.push(`**Payment Details:**\n${UNAVAILABLE}`);
      }
      break;
    }

    case 'DRAFT_STATUS': {
      const result = await fetchDrafts(user);
      sections.push(`**${result.label}:**\n${result.text}`);
      break;
    }

    case 'SAMPLE_STATUS': {
      const result = await fetchSamples(user);
      sections.push(`**${result.label}:**\n${result.text}`);
      break;
    }

    case 'CART_HELP': {
      const result = await fetchCart(user);
      sections.push(`**${result.label}:**\n${result.text}`);
      break;
    }

    case 'ACCOUNT_HELP': {
      if (role === 'ADMIN') {
        const result = await fetchUsers();
        sections.push(`**${result.label}:**\n${result.text}`);
      } else {
        // Return only the user's own profile
        try {
          const self = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              status: true,
              isEmailVerified: true,
              createdAt: true,
            },
          });
          if (self) {
            sections.push(
              `**Your Account:**\nName: ${self.firstName} ${self.lastName} | Email: ${self.email} | Phone: ${self.phone || 'N/A'} | Role: ${self.role} | Status: ${self.status} | Email Verified: ${self.isEmailVerified} | Member since: ${new Date(self.createdAt).toLocaleDateString()}`
            );
          } else {
            sections.push(`**Your Account:**\n${UNAVAILABLE}`);
          }
        } catch {
          sections.push(`**Your Account:**\n${UNAVAILABLE}`);
        }
      }
      break;
    }

    case 'ADMIN_OVERVIEW': {
      // Only reaches here if role === ADMIN (access guard above)
      const [auditResult, usersResult, ordersResult] = await Promise.all([
        fetchAuditLogs(),
        fetchUsers(),
        fetchOrders(user),
      ]);
      sections.push(`**${auditResult.label}:**\n${auditResult.text}`);
      sections.push(`**${usersResult.label}:**\n${usersResult.text}`);
      sections.push(`**${ordersResult.label}:**\n${ordersResult.text}`);
      break;
    }

    // PLATFORM_INFO, GREETING, GENERAL_SUPPORT – no DB fetch needed
    default:
      break;
  }

  if (sections.length === 0) return '';
  return sections.join('\n\n');
}

module.exports = { fetchContextForUser };
