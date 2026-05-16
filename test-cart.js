const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.cartItem.findMany({
    include: { product: true }
  });
  console.log("Cart items count:", items.length);
  const nullProducts = items.filter(i => !i.product);
  console.log("Null products count:", nullProducts.length);
  if (nullProducts.length > 0) {
    console.log("Example null product cartItem:", nullProducts[0]);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });
