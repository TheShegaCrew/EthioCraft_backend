const prisma = require('../src/config/prisma');

async function main() {
  const items = await prisma.cartItem.findMany({ include: { product: true } });
  console.log('Items:', items.length);
  const noProd = items.filter((i) => !i.product);
  console.log('No prod:', noProd);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
