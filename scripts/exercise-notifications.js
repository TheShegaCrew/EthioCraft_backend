require('dotenv').config();
const prisma = require('../src/config/prisma');
const jwt = require('../src/utils/jwt');
const axios = require('axios');

const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') + '/api/v1' : 'http://localhost:4000/api/v1';

async function run(){
  await prisma.$connect();
  const customer = await prisma.user.findUnique({ where: { email: 'customer1@ethiocraft.com' } });
  const admin = await prisma.user.findUnique({ where: { email: 'admin@ethiocraft.com' } });
  if(!customer || !admin){
    console.error('seeded users not found');
    process.exit(2);
  }

  const customerToken = jwt.generateAccessToken(customer);
  const adminToken = jwt.generateAccessToken(admin);

  console.log('Base API URL:', baseUrl);
  console.log('Customer ID:', customer.id);
  console.log('Admin ID:', admin.id);

  // Fetch notifications for customer
  const listRes = await axios.get(baseUrl + '/notifications/me', { headers: { Authorization: `Bearer ${customerToken}` } });
  console.log('Initial notifications count:', listRes.data.data.length);
  if(listRes.data.data.length > 0){
    const note = listRes.data.data[0];
    console.log('Marking as read:', note.id, note.title);
    const markRes = await axios.patch(baseUrl + `/notifications/${note.id}/read`, {}, { headers: { Authorization: `Bearer ${customerToken}` } });
    console.log('Mark response:', markRes.data.message);
  }

  // Admin sends a notification to the customer
  const notifyPayload = { title: 'Admin Message', message: 'This is a test admin notification', type: 'GENERAL' };
  const sendRes = await axios.post(baseUrl + `/admin/users/${customer.id}/notify`, notifyPayload, { headers: { Authorization: `Bearer ${adminToken}` } });
  console.log('Admin notify response:', sendRes.status, sendRes.data.message, 'note id:', sendRes.data.data?.id);

  // Fetch again
  const listRes2 = await axios.get(baseUrl + '/notifications/me', { headers: { Authorization: `Bearer ${customerToken}` } });
  console.log('Final notifications count:', listRes2.data.data.length);

  await prisma.$disconnect();
}

run().catch(err=>{ console.error(err.response?.data || err.message || err); process.exit(1); });
