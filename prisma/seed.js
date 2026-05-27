const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertUser({ email, passwordHash, ...rest }) {
  return prisma.user.upsert({
    where: { email },
    update: {
      ...rest,
      passwordHash,
    },
    create: {
      email,
      passwordHash,
      ...rest,
    },
  });
}

async function createAddressIfNotExist(user, addressData) {
  const existing = await prisma.address.findFirst({
    where: { userId: user.id, line1: addressData.line1 },
  });
  if (!existing) {
    await prisma.address.create({
      data: {
        userId: user.id,
        label: "Home",
        recipientName: `${user.firstName} ${user.lastName}`,
        phone: user.phone || "+251900000000",
        region: addressData.region,
        city: addressData.city,
        subCity: addressData.subCity,
        woreda: addressData.woreda,
        line1: addressData.line1,
        line2: addressData.line2,
        isDefault: true,
      },
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  // 1 admin, 2 verification agents, 3 artisans, 4 customers
  const admin = await upsertUser({
    email: "admin@ethiocraft.com",
    passwordHash,
    firstName: "Amanuel",
    lastName: "Bekele",
    phone: "+251900000001",
    role: "ADMIN",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const verificationAgent1 = await upsertUser({
    email: "agent1@ethiocraft.com",
    passwordHash,
    firstName: "Lulit",
    lastName: "Tadesse",
    phone: "+251900000002",
    role: "VERIFICATION_AGENT",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const verificationAgent2 = await upsertUser({
    email: "agent2@ethiocraft.com",
    passwordHash,
    firstName: "Bekele",
    lastName: "Yosef",
    phone: "+251900000010",
    role: "VERIFICATION_AGENT",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const artisan1 = await upsertUser({
    email: "artisan1@ethiocraft.com",
    passwordHash,
    firstName: "Marta",
    lastName: "Haile",
    phone: "+251900000003",
    role: "ARTISAN",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const artisan2 = await upsertUser({
    email: "artisan2@ethiocraft.com",
    passwordHash,
    firstName: "Bekele",
    lastName: "Fikre",
    phone: "+251900000005",
    role: "ARTISAN",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const artisan3 = await upsertUser({
    email: "artisan3@ethiocraft.com",
    passwordHash,
    firstName: "Selam",
    lastName: "Mekdes",
    phone: "+251900000006",
    role: "ARTISAN",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const customer1 = await upsertUser({
    email: "customer1@ethiocraft.com",
    passwordHash,
    firstName: "Samuel",
    lastName: "Kassa",
    phone: "+251900000004",
    role: "CUSTOMER",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const customer2 = await upsertUser({
    email: "customer2@ethiocraft.com",
    passwordHash,
    firstName: "Dawit",
    lastName: "Abebe",
    phone: "+251900000007",
    role: "CUSTOMER",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const customer3 = await upsertUser({
    email: "customer3@ethiocraft.com",
    passwordHash,
    firstName: "Hanna",
    lastName: "Mulu",
    phone: "+251900000008",
    role: "CUSTOMER",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const customer4 = await upsertUser({
    email: "customer4@ethiocraft.com",
    passwordHash,
    firstName: "Abeba",
    lastName: "Kebede",
    phone: "+251900000009",
    role: "CUSTOMER",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  // Add addresses for agents and artisans (Addis Ababa & Hawassa)
  const agents = [verificationAgent1, verificationAgent2];
  const artisans = [artisan1, artisan2, artisan3];

  // Agent 1 – Addis Ababa
  await createAddressIfNotExist(verificationAgent1, {
    city: "Addis Ababa",
    region: "Addis Ababa",
    subCity: "Bole",
    woreda: "03",
    line1: "Bole Medhanialem",
    line2: "Near Edna Mall",
  });

  // Agent 2 – Hawassa
  await createAddressIfNotExist(verificationAgent2, {
    city: "Hawassa",
    region: "SNNPR",
    subCity: "Tabor",
    woreda: "02",
    line1: "Tabor Street",
    line2: "Near Lake Hawassa",
  });

  // Artisan 1 – Addis Ababa
  await createAddressIfNotExist(artisan1, {
    city: "Addis Ababa",
    region: "Addis Ababa",
    subCity: "Yeka",
    woreda: "05",
    line1: "Megenagna",
    line2: "Around CMC",
  });

  // Artisan 2 – Hawassa
  await createAddressIfNotExist(artisan2, {
    city: "Hawassa",
    region: "SNNPR",
    subCity: "Menaharia",
    woreda: "01",
    line1: "Piazza Hawassa",
    line2: "",
  });

  // Artisan 3 – Addis Ababa
  await createAddressIfNotExist(artisan3, {
    city: "Addis Ababa",
    region: "Addis Ababa",
    subCity: "Arada",
    woreda: "01",
    line1: "Piassa",
    line2: "Near St. George Church",
  });

  // Also add addresses for customers (as before but now included)
  const customers = [customer1, customer2, customer3, customer4];
  for (const c of customers) {
    await createAddressIfNotExist(c, {
      city: "Addis Ababa",
      region: "Addis Ababa",
      subCity: "Bole",
      woreda: "03",
      line1: "Bole Medhanialem",
      line2: "Near Edna Mall",
    });
  }

  console.log("Seed completed.");
  console.log(
    "Users created: ",
    [
      admin.email,
      verificationAgent1.email,
      verificationAgent2.email,
      artisan1.email,
      artisan2.email,
      artisan3.email,
      customer1.email,
      customer2.email,
      customer3.email,
      customer4.email,
    ].join(", ")
  );
  console.log("Addresses added for agents, artisans, and customers.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });