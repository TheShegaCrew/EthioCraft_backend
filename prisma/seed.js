const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

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

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await upsertUser({
    email: "admin@ethiocraft.com",
    passwordHash,
    firstName: "Amanuel",
    lastName: "Bekele",
    phone: "+251900000001",
    role: "ADMIN",
    status: "ACTIVE",
  });

  const verificationAgent = await upsertUser({
    email: "agent@ethiocraft.com",
    passwordHash,
    firstName: "Lulit",
    lastName: "Tadesse",
    phone: "+251900000002",
    role: "VERIFICATION_AGENT",
    status: "ACTIVE",
  });

  const artisan = await upsertUser({
    email: "artisan@ethiocraft.com",
    passwordHash,
    firstName: "Marta",
    lastName: "Haile",
    phone: "+251900000003",
    role: "ARTISAN",
    status: "ACTIVE",
  });

  const customer = await upsertUser({
    email: "customer@ethiocraft.com",
    passwordHash,
    firstName: "Samuel",
    lastName: "Kassa",
    phone: "+251900000004",
    role: "CUSTOMER",
    status: "ACTIVE",
  });

  await prisma.artisanProfile.upsert({
    where: { userId: artisan.id },
    update: {
      shopName: "Marta Woven Craft",
      bio: "Traditional Addis Ababa artisan focused on woven baskets and table pieces.",
      city: "Addis Ababa",
      region: "Addis Ababa",
      verificationStatus: "APPROVED",
    },
    create: {
      userId: artisan.id,
      shopName: "Marta Woven Craft",
      bio: "Traditional Addis Ababa artisan focused on woven baskets and table pieces.",
      city: "Addis Ababa",
      region: "Addis Ababa",
      verificationStatus: "APPROVED",
    },
  });

  const existingAddress = await prisma.address.findFirst({
    where: {
      userId: customer.id,
      line1: "Bole Medhanialem",
    },
  });

  const address =
    existingAddress ||
    (await prisma.address.create({
      data: {
        userId: customer.id,
        label: "Home",
        recipientName: "Samuel Kassa",
        phone: "+251900000004",
        region: "Addis Ababa",
        city: "Addis Ababa",
        subCity: "Bole",
        woreda: "03",
        line1: "Bole Medhanialem",
        line2: "Near Edna Mall",
        isDefault: true,
      },
    }));

  const draftTitle = "Handwoven Mesob Basket";
  let draft = await prisma.productDraft.findFirst({
    where: {
      artisanId: artisan.id,
      title: draftTitle,
    },
  });

  if (!draft) {
    draft = await prisma.productDraft.create({
      data: {
        artisanId: artisan.id,
        title: draftTitle,
        description: "Colorful handwoven mesob basket crafted from natural fibers by Addis Ababa artisans.",
        category: "Baskets",
        price: 1450,
        stock: 12,
        materials: ["Natural grass", "Cotton thread"],
        tags: ["woven", "mesob", "tableware"],
        dimensions: {
          widthCm: 32,
          heightCm: 24,
        },
        status: "APPROVED",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: verificationAgent.id,
      },
    });
  }

  let product = await prisma.product.findUnique({
    where: { draftId: draft.id },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        artisanId: artisan.id,
        draftId: draft.id,
        title: draft.title,
        slug: "handwoven-mesob-basket",
        description: draft.description,
        category: draft.category,
        price: draft.price,
        currency: draft.currency,
        stock: draft.stock,
        materials: draft.materials,
        tags: draft.tags,
        dimensions: draft.dimensions,
        status: "PUBLISHED",
        approvedAt: new Date(),
        publishedAt: new Date(),
        verifiedById: verificationAgent.id,
      },
    });
  }

  const draftMediaExists = await prisma.media.findFirst({
    where: { draftId: draft.id },
  });

  if (!draftMediaExists) {
    await prisma.media.createMany({
      data: [
        {
          ownerType: "PRODUCT_DRAFT",
          kind: "IMAGE",
          draftId: draft.id,
          url: "/uploads/products/sample-mesob.jpg",
          mimeType: "image/jpeg",
          altText: draft.title,
          sortOrder: 0,
        },
        {
          ownerType: "PRODUCT",
          kind: "IMAGE",
          productId: product.id,
          url: "/uploads/products/sample-mesob.jpg",
          mimeType: "image/jpeg",
          altText: product.title,
          sortOrder: 0,
        },
      ],
    });
  }

  console.log("Seed completed.");
  console.log("Admin:", admin.email, "Password123!");
  console.log("Verification Agent:", verificationAgent.email, "Password123!");
  console.log("Artisan:", artisan.email, "Password123!");
  console.log("Customer:", customer.email, "Password123!");
  console.log("Sample customer address ID:", address.id);
  console.log("Sample product ID:", product.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
