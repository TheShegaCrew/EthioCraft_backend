const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");

const server = app.listen(env.port, () => {
  console.log(`Ethiopian Handcraft Marketplace API listening on port ${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully.`);

  server.close(async () => {  
    await prisma.$disconnect();
    process.exit(0);
  });
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch(() => process.exit(1));
  });
});
 
