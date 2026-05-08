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
  const password = "Password123!";

  // Create 10 users across roles: 1 admin, 2 agents, 3 artisans, 4 customers
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

  const artisans = [artisan1, artisan2, artisan3];
  const verificationAgents = [verificationAgent1, verificationAgent2];
  const customers = [customer1, customer2, customer3, customer4];

  // Create artisan profiles for each artisan
  for (const a of artisans) {
    await prisma.artisanProfile.upsert({
      where: { userId: a.id },
      update: {
        shopName: `${a.firstName} ${a.lastName} Crafts`,
        bio: `Handmade products by ${a.firstName} ${a.lastName}`,
        city: "Addis Ababa",
        region: "Addis Ababa",
        verificationStatus: "APPROVED",
      },
      create: {
        userId: a.id,
        shopName: `${a.firstName} ${a.lastName} Crafts`,
        bio: `Handmade products by ${a.firstName} ${a.lastName}`,
        city: "Addis Ababa",
        region: "Addis Ababa",
        verificationStatus: "APPROVED",
      },
    });
  }

  // Ensure each customer has a default address
  for (const c of customers) {
    const existingAddress = await prisma.address.findFirst({
      where: {
        userId: c.id,
        line1: "Bole Medhanialem",
      },
    });

    if (!existingAddress) {
      await prisma.address.create({
        data: {
          userId: c.id,
          label: "Home",
          recipientName: `${c.firstName} ${c.lastName}`,
          phone: c.phone || "+251900000000",
          region: "Addis Ababa",
          city: "Addis Ababa",
          subCity: "Bole",
          woreda: "03",
          line1: "Bole Medhanialem",
          line2: "Near Edna Mall",
          isDefault: true,
        },
      });
    }
  }

  // 25 product seeds covering categories, artisans will be rotated across items
  const productSeeds = [
    { title: "Habesha Cotton Dress", slug: "habesha-cotton-dress", category: "Textiles", price: 168, stock: 15, description: "A refined hand-loomed cotton dress with authentic Ethiopian detailing.", materials: ["Cotton"], tags: ["handmade","dress","traditional"], image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80" },
    { title: "Lalibela Filigree Earrings", slug: "lalibela-filigree-earrings", category: "Jewelry", price: 124, stock: 20, description: "Silver filigree earrings inspired by Lalibela motifs.", materials: ["Silver"], tags: ["earrings","jewelry"], image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80" },
    { title: "Sidama Coffee Ceremony Set", slug: "sidama-coffee-ceremony-set", category: "Home", price: 210, stock: 8, description: "A clay coffee ceremony set representing Sidama coffee culture.", materials: ["Clay"], tags: ["coffee","ceremony"], image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80" },
    { title: "Woven Mesob Basket", slug: "woven-mesob-basket", category: "Home", price: 96, stock: 25, description: "Handwoven mesob basket crafted from natural fibers.", materials: ["Straw"], tags: ["woven","mesob"], image: "https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?auto=format&fit=crop&w=900&q=80" },
    { title: "Addis Leather Weekender", slug: "addis-leather-weekender", category: "Accessories", price: 182, stock: 10, description: "Premium leather weekender bag made in Addis.", materials: ["Leather"], tags: ["bag","leather"], image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80" },
    { title: "Hand-Loomed Gabi Shawl", slug: "hand-loomed-gabi-shawl", category: "Textiles", price: 88, stock: 18, description: "Soft hand-loomed gabi shawl woven from Ethiopian cotton.", materials: ["Cotton"], tags: ["shawl","textile"], image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80" },
    { title: "Axum Cross Pendant", slug: "axum-cross-pendant", category: "Jewelry", price: 116, stock: 14, description: "Silver pendant inspired by Axumite cross forms.", materials: ["Silver"], tags: ["pendant","silver"], image: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80" },
    { title: "Harar Palm Tote", slug: "harar-palm-tote", category: "Accessories", price: 74, stock: 22, description: "Lightweight palm tote inspired by Harar craft traditions.", materials: ["Straw"], tags: ["tote","handmade"], image: "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80" },
    { title: "Ethiopian Pottery Bowl", slug: "ethiopian-pottery-bowl", category: "Home", price: 58, stock: 30, description: "Handmade pottery bowl with traditional glazing.", materials: ["Clay"], tags: ["pottery","home"], image: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=80" },
    { title: "Tepi Woven Scarf", slug: "tepi-woven-scarf", category: "Textiles", price: 42, stock: 40, description: "Lightweight woven scarf with tepi patterns.", materials: ["Cotton"], tags: ["scarf","woven"], image: "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=900&q=80" },
    { title: "Traditional Coffee Pot (Jebena)", slug: "jebena-coffee-pot", category: "Home", price: 35, stock: 12, description: "Handcrafted jebena for traditional coffee preparation.", materials: ["Clay"], tags: ["coffee","jebena"], image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80" },
    { title: "Hand-Carved Wooden Spoon", slug: "hand-carved-wooden-spoon", category: "Home", price: 12, stock: 80, description: "Carved wooden spoon made from local timber.", materials: ["Wood"], tags: ["kitchen","woodwork"], image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80" },
    { title: "Etiopica Beaded Necklace", slug: "etiopica-beaded-necklace", category: "Jewelry", price: 64, stock: 26, description: "Colorful beaded necklace representing regional motifs.", materials: ["Beads"], tags: ["necklace","beads"], image: "https://images.unsplash.com/photo-1533229507443-7b7a6a5f9f7e?auto=format&fit=crop&w=900&q=80" },
    { title: "Handwoven Table Runner", slug: "handwoven-table-runner", category: "Home", price: 54, stock: 20, description: "Handwoven runner for dining tables.", materials: ["Cotton"], tags: ["table","woven"], image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80" },
    { title: "Shema Embroidered Pillow", slug: "shema-embroidered-pillow", category: "Home", price: 46, stock: 16, description: "Decorative pillow with shema embroidery.", materials: ["Cotton"], tags: ["pillow","embroidery"], image: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=900&q=80" },
    { title: "Sidamo Coffee Beans (250g)", slug: "sidamo-coffee-250g", category: "Food", price: 12, stock: 120, description: "Fresh roasted Sidamo beans.", materials: [], tags: ["coffee","beans"], image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80" },
    { title: "Handmade Basket (Small)", slug: "handmade-basket-small", category: "Home", price: 22, stock: 50, description: "Small basket for household use.", materials: ["Straw"], tags: ["basket","handmade"], image: "https://images.unsplash.com/photo-1524594154901-87f3c1b7d9c6?auto=format&fit=crop&w=900&q=80" },
    { title: "Leather Coin Pouch", slug: "leather-coin-pouch", category: "Accessories", price: 18, stock: 60, description: "Small leather pouch for coins.", materials: ["Leather"], tags: ["leather","pouch"], image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80" },
    { title: "Woolen Socks (Pair)", slug: "woolen-socks-pair", category: "Textiles", price: 14, stock: 70, description: "Warm woolen socks handcrafted locally.", materials: ["Wool"], tags: ["socks","wool"], image: "https://images.unsplash.com/photo-1520975912062-31a0d7c0362d?auto=format&fit=crop&w=900&q=80" },
    { title: "Vintage Brass Candle Holder", slug: "vintage-brass-candle-holder", category: "Home", price: 68, stock: 12, description: "Brass candle holder with patina.", materials: ["Brass"], tags: ["brass","vintage"], image: "https://images.unsplash.com/photo-1533658925629-1a2fca8f0a4b?auto=format&fit=crop&w=900&q=80" },
    { title: "Handmade Soap Bar", slug: "handmade-soap-bar", category: "Personal Care", price: 6, stock: 200, description: "Natural soap bar made with local oils.", materials: ["Oil"], tags: ["soap","natural"], image: "https://images.unsplash.com/photo-1514846331202-78c8f0f7b0c5?auto=format&fit=crop&w=900&q=80" },
    { title: "Ceramic Incense Burner", slug: "ceramic-incense-burner", category: "Home", price: 30, stock: 18, description: "Handmade ceramic incense burner.", materials: ["Ceramic"], tags: ["incense","ceramic"], image: "https://images.unsplash.com/photo-1541580627-4e0b3f2c7f9b?auto=format&fit=crop&w=900&q=80" },
    { title: "Embroidered Apron", slug: "embroidered-apron", category: "Accessories", price: 28, stock: 22, description: "Kitchen apron with traditional embroidery.", materials: ["Cotton"], tags: ["apron","embroidery"], image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80" },
    { title: "Handpainted Wall Tile", slug: "handpainted-wall-tile", category: "Home", price: 44, stock: 30, description: "Decorative tile painted by local artisans.", materials: ["Ceramic"], tags: ["tile","art"], image: "https://images.unsplash.com/photo-1533587851505-0e2f4a4d3b7b?auto=format&fit=crop&w=900&q=80" },
    { title: "Kettle Woven Tray", slug: "kettle-woven-tray", category: "Home", price: 26, stock: 35, description: "Woven tray for serving and display.", materials: ["Straw"], tags: ["tray","woven"], image: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=900&q=80" }
  ];

  const seededProducts = [];

  let idx = 0;
  for (const item of productSeeds) {
    const artisan = artisans[idx % artisans.length];
    const verifier = verificationAgents[idx % verificationAgents.length];

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
        reviewedById: verifier.id,
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
        reviewedById: verifier.id,
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
        verifiedById: verifier.id,
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
        verifiedById: verifier.id,
      },
    });

    await prisma.media.deleteMany({ where: { OR: [{ draftId: draft.id }, { productId: product.id }] } });

    await prisma.media.createMany({
      data: [
        { ownerType: "PRODUCT_DRAFT", kind: "IMAGE", draftId: draft.id, url: item.image, mimeType: "image/jpeg", altText: item.title, sortOrder: 0 },
        { ownerType: "PRODUCT", kind: "IMAGE", productId: product.id, url: item.image, mimeType: "image/jpeg", altText: item.title, sortOrder: 0 },
      ],
    });

    seededProducts.push(product);
    idx++;
  }
  // Create reviews for some products
  let reviewCount = 0;
  for (const prod of seededProducts) {
    const numReviews = Math.floor(Math.random() * 3); // 0-2 reviews
    for (let r = 0; r < numReviews; r++) {
      const cust = customers[Math.floor(Math.random() * customers.length)];
      const exists = await prisma.review.findFirst({ where: { productId: prod.id, customerId: cust.id } });
      if (exists) continue;
      const rating = 3 + Math.floor(Math.random() * 3); // 3-5
      await prisma.review.create({
        data: {
          productId: prod.id,
          customerId: cust.id,
          rating,
          title: `Review for ${prod.title}`,
          comment: `Customer ${cust.firstName} liked this product.`,
        },
      });
      reviewCount++;
    }
  }

  // Create samples and attach to one draft per artisan where possible
  const samplesCreated = [];
  for (const a of artisans) {
    const sampleId = `seed-sample-${a.id}`;
    const sample = await prisma.sample.upsert({
      where: { id: sampleId },
      update: {
        title: `${a.firstName} ${a.lastName} Sample`,
        description: `Sample submissions by ${a.firstName} ${a.lastName}`,
        category: "Sample",
        price: 0,
        stock: 0,
        status: "SUBMITTED",
        submittedAt: new Date(),
        createdAt: new Date(),
      },
      create: {
        id: sampleId,
        artisanId: a.id,
        title: `${a.firstName} ${a.lastName} Sample`,
        description: `Sample submissions by ${a.firstName} ${a.lastName}`,
        category: "Sample",
        price: 0,
        stock: 0,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    // Attach first available draft to this sample (if any)
    const draftToAttach = await prisma.productDraft.findFirst({ where: { artisanId: a.id, sampleId: null } });
    if (draftToAttach) {
      await prisma.productDraft.update({ where: { id: draftToAttach.id }, data: { sampleId: sample.id } });
    }

    // add a media record for the sample
    await prisma.media.createMany({ data: [
      { ownerType: "SAMPLE", kind: "IMAGE", sampleId: sample.id, url: seededProducts[0]?.image || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80", mimeType: "image/jpeg", altText: `${sample.title} image`, sortOrder: 0 }
    ] });

    samplesCreated.push(sample);
  }
  // Create sample orders and payments for customers
  const orders = [];
  for (const c of customers) {
    const addr = await prisma.address.findFirst({ where: { userId: c.id } });
    if (!addr) continue;

    // Pick 1-3 random products
    const count = 1 + (Math.floor(Math.random() * 3));
    const items = [];
    for (let i = 0; i < count; i++) {
      const prod = seededProducts[Math.floor(Math.random() * seededProducts.length)];
      const qty = 1 + Math.floor(Math.random() * 3);
      items.push({ product: prod, qty });
    }

    const subtotal = items.reduce((s, it) => s + Number(it.product.price) * it.qty, 0);
    const shippingFee = 5.0;
    const taxAmount = 0.0;
    const totalAmount = subtotal + shippingFee + taxAmount;

    const order = await prisma.order.create({
      data: {
        customerId: c.id,
        addressId: addr.id,
        status: "PAID",
        subtotalAmount: subtotal,
        shippingFee: shippingFee,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        currency: "ETB",
        paidAt: new Date(),
      },
    });

    for (const it of items) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.product.id,
          artisanId: it.product.artisanId,
          productName: it.product.title,
          unitPrice: it.product.price,
          quantity: it.qty,
          lineTotal: Number(it.product.price) * it.qty,
        },
      });
    }

    // Create a payment record (simulate success)
    const txRef = `seed-tx-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    await prisma.payment.create({
      data: {
        orderId: order.id,
        customerId: c.id,
        provider: "SIMULATION",
        status: "SUCCESS",
        amount: totalAmount,
        currency: "ETB",
        txRef,
        paidAt: new Date(),
        providerPayload: { simulated: true },
      },
    });

    orders.push(order);
  }

  console.log("Seed completed.");
  console.log("Users created: ", [admin.email, verificationAgent1.email, verificationAgent2.email, artisan1.email, artisan2.email, artisan3.email, customer1.email, customer2.email, customer3.email, customer4.email].join(", "));
  console.log("Published products seeded:", seededProducts.length);
  console.log("Orders created:", orders.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
