require('dotenv').config();
const prisma = require('../src/config/prisma');
const jwt = require('../src/utils/jwt');

async function run(email){
  await prisma.$connect();
  const u = await prisma.user.findUnique({ where: { email } });
  if(!u){
    console.error('user not found for', email);
    process.exit(2);
  }
  console.log('USER_ID:' + u.id);
  console.log('TOKEN:' + jwt.generateAccessToken(u));
  await prisma.$disconnect();
}

const email = process.argv[2];
if(!email){
  console.error('Usage: node scripts/generate-token-local.js <email>');
  process.exit(1);
}
run(email).catch(err=>{ console.error(err); process.exit(1); });
