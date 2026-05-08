const prisma = require('../src/config/prisma');

(async () => {
  try {
    const emails = ['admin@ethiocraft.com','agent@ethiocraft.com','artisan@ethiocraft.com','customer@ethiocraft.com'];
    for (const email of emails) {
      const u = await prisma.user.updateMany({ where: { email }, data: { isEmailVerified: true } });
      console.log(`Updated ${email}:`, u.count);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
