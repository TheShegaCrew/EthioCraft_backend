require('dotenv').config();
const prisma = require('./src/config/prisma');

async function run() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE product_drafts CASCADE;`);
}
run().then(() => console.log("Done")).catch(console.error).finally(() => prisma.$disconnect());
