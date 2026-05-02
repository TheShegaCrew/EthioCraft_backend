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

  const productSeeds = [
    {
      title: "Habesha Cotton Dress",
      slug: "habesha-cotton-dress",
      category: "Textiles",
      price: 168,
      stock: 15,
      description:
        "A refined hand-loomed cotton dress with authentic Ethiopian detailing and artisanal finishing.",
      materials: ["Cotton"],
      tags: ["handmade", "dress", "traditional"],
      image:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Lalibela Filigree Earrings",
      slug: "lalibela-filigree-earrings",
      category: "Jewelry",
      price: 124,
      stock: 20,
      description:
        "Silver filigree earrings inspired by Lalibela motifs and handcrafted by local makers.",
      materials: ["Silver"],
      tags: ["new", "earrings", "jewelry"],
      image:
        "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Sidama Coffee Ceremony Set",
      slug: "sidama-coffee-ceremony-set",
      category: "Home",
      price: 210,
      stock: 8,
      description:
        "A complete clay coffee ceremony set representing Sidama coffee culture and hospitality.",
      materials: ["Clay"],
      tags: ["coffee", "home", "ceremony"],
      image:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Woven Mesob Basket",
      slug: "woven-mesob-basket",
      category: "Home",
      price: 96,
      stock: 25,
      description:
        "Colorful handwoven mesob basket crafted from natural fibers by Addis Ababa artisans.",
      materials: ["Straw"],
      tags: ["woven", "mesob", "tableware"],
      image:
        "https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Addis Leather Weekender",
      slug: "addis-leather-weekender",
      category: "Accessories",
      price: 182,
      stock: 10,
      description:
        "Premium leather weekender bag made in Addis with durable stitching and timeless design.",
      materials: ["Leather"],
      tags: ["bag", "leather", "travel"],
      image:
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Hand-Loomed Gabi Shawl",
      slug: "hand-loomed-gabi-shawl",
      category: "Textiles",
      price: 88,
      stock: 18,
      description:
        "Soft hand-loomed gabi shawl woven from Ethiopian cotton for everyday warmth and style.",
      materials: ["Cotton"],
      tags: ["shawl", "gabi", "textile"],
      image:
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Axum Cross Pendant",
      slug: "axum-cross-pendant",
      category: "Jewelry",
      price: 116,
      stock: 14,
      description:
        "A silver pendant inspired by historic Axumite cross forms, handcrafted by Ethiopian artisans.",
      materials: ["Silver"],
      tags: ["pendant", "cross", "silver"],
      image:
        "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Harar Palm Tote",
      slug: "harar-palm-tote",
      category: "Accessories",
      price: 74,
      stock: 22,
      description:
        "A lightweight palm tote inspired by Harar craft traditions and made for daily use.",
      materials: ["Straw"],
      tags: ["tote", "palm", "handmade"],
      image:
        "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80",
    },
  ];

  const seededProducts = [];

  for (const item of productSeeds) {
    const draft = await prisma.productDraft.upsert({
      where: { id: `seed-draft-${item.slug}` },
      update: {
        artisanId: artisan.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price: item.price,
        stock: item.stock,
        materials: item.materials,
        tags: item.tags,
        status: "AGENT_VERIFIED",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: verificationAgent.id,
      },
      create: {
        id: `seed-draft-${item.slug}`,
        artisanId: artisan.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price: item.price,
        stock: item.stock,
        materials: item.materials,
        tags: item.tags,
        status: "AGENT_VERIFIED",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: verificationAgent.id,
      },
    });

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        artisanId: artisan.id,
        draftId: draft.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price: item.price,
        stock: item.stock,
        materials: item.materials,
        tags: item.tags,
        status: "PUBLISHED",
        approvedAt: new Date(),
        publishedAt: new Date(),
        verifiedById: verificationAgent.id,
      },
      create: {
        artisanId: artisan.id,
        draftId: draft.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        category: item.category,
        price: item.price,
        stock: item.stock,
        materials: item.materials,
        tags: item.tags,
        status: "PUBLISHED",
        approvedAt: new Date(),
        publishedAt: new Date(),
        verifiedById: verificationAgent.id,
      },
    });

    await prisma.media.deleteMany({
      where: {
        OR: [{ draftId: draft.id }, { productId: product.id }],
      },
    });

    await prisma.media.createMany({
      data: [
        {
          ownerType: "PRODUCT_DRAFT",
          kind: "IMAGE",
          draftId: draft.id,
          url: item.image,
          mimeType: "image/jpeg",
          altText: item.title,
          sortOrder: 0,
        },
        {
          ownerType: "PRODUCT",
          kind: "IMAGE",
          productId: product.id,
          url: item.image,
          mimeType: "image/jpeg",
          altText: item.title,
          sortOrder: 0,
        },
      ],
    });

    seededProducts.push(product);
  }

  console.log("Seed completed.");
  console.log("Admin:", admin.email, "Password123!");
  console.log("Verification Agent:", verificationAgent.email, "Password123!");
  console.log("Artisan:", artisan.email, "Password123!");
  console.log("Customer:", customer.email, "Password123!");
  console.log("Sample customer address ID:", address.id);
  console.log("Published products seeded:", seededProducts.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
