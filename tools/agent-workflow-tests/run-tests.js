const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const DRAFT_ID = process.env.DRAFT_ID;
const ORDER_ID = process.env.ORDER_ID;

if (!AUTH_TOKEN) {
  console.error('Set AUTH_TOKEN env var (Bearer token)');
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
  validateStatus: () => true,
});

async function run() {
  console.log('Base URL:', BASE_URL);

  console.log('\n1) PATCH /users/me (profile save)');
  let res = await client.patch('/users/me', {
    firstName: 'Test',
    lastName: 'User',
    phone: '+251900000000',
    email: 'test@example.com',
    artisanProfile: { region: 'TestRegion' },
  });
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(res.data, null, 2));

  if (DRAFT_ID) {
    console.log(`\n2) PATCH /verifications/products/drafts/${DRAFT_ID} (agent update)`);
    res = await client.patch(`/verifications/products/drafts/${DRAFT_ID}`, { title: 'Agent updated title' });
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.data, null, 2));
  } else {
    console.log('\n2) Skipping verification draft test (DRAFT_ID not set)');
  }

  if (ORDER_ID) {
    console.log(`\n3) PATCH /orders/${ORDER_ID}/status (order status update)`);
    res = await client.patch(`/orders/${ORDER_ID}/status`, { status: 'PROCESSING' });
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.data, null, 2));
  } else {
    console.log('\n3) Skipping order status test (ORDER_ID not set)');
  }
}

run().catch((err) => {
  console.error('Error running tests:', err && err.message ? err.message : err);
  process.exit(1);
});
