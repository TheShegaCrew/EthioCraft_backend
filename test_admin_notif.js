const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  const adminIds = admins.map(a => a.id);
  const notifs = await prisma.notification.findMany({ 
    where: { userId: { in: adminIds } }, 
    take: 10, 
    select: { type: true, title: true } 
  });
  console.log('Admin Notifications:', notifs);
}

run().finally(() => prisma.$disconnect());
