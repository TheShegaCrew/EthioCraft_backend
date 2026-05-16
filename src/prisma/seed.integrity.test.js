describe('Prisma seed integrity', () => {
  const hasDb = !!process.env.DATABASE_URL;
  let prisma;

  beforeAll(async () => {
    if (!hasDb) return;
    prisma = require('../config/prisma');
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!hasDb) return;
    await prisma.$disconnect();
  });

  (hasDb ? it : it.skip)('has seeded notifications and users', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@ethiocraft.com' } });
    expect(admin).toBeTruthy();

    const customer1 = await prisma.user.findUnique({ where: { email: 'customer1@ethiocraft.com' } });
    expect(customer1).toBeTruthy();

    const notificationsForCustomer1 = await prisma.notification.findMany({ where: { userId: customer1.id } });
    expect(notificationsForCustomer1.length).toBeGreaterThanOrEqual(1);

    const totalNotifications = await prisma.notification.count();
    expect(totalNotifications).toBeGreaterThanOrEqual(5);
  }, 20000);
});
