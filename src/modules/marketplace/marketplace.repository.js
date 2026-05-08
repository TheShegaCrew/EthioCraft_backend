const prisma = require("../../config/prisma");

function listPublishedProducts(where, orderBy, skip, take) {
  return prisma.product.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      media: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 1,
      },
      artisan: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          artisanProfile: {
            select: {
              shopName: true,
              city: true,
              region: true,
            },
          },
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });
}

function countPublishedProducts(where) {
  return prisma.product.count({ where });
}

function findPublishedProductByIdOrSlug(identifier) {
  return prisma.product.findFirst({
    where: {
      status: "PUBLISHED",
      OR: [{ id: identifier }, { slug: identifier }],
    },
    include: {
      media: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      artisan: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          artisanProfile: {
            select: {
              shopName: true,
              bio: true,
              city: true,
              region: true,
            },
          },
        },
      },
      reviews: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
}

function listRelatedPublishedProducts({ category, excludeProductId, take = 3 }) {
  return prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      category,
      NOT: { id: excludeProductId },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take,
    include: {
      media: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 1,
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });
}

function hasDeliveredOrderForProduct({ productId, customerId }) {
  return prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        customerId,
        status: "DELIVERED",
      },
    },
    select: {
      id: true,
    },
  });
}

function createReview({ productId, customerId, rating, comment }) {
  return prisma.review.create({
    data: {
      productId,
      customerId,
      rating,
      comment,
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

const productListInclude = {
  media: {
    orderBy: {
      sortOrder: "asc",
    },
    take: 1,
  },
  artisan: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      artisanProfile: {
        select: {
          shopName: true,
          city: true,
          region: true,
        },
      },
    },
  },
  _count: {
    select: {
      reviews: true,
    },
  },
};

function listPublishedProductsInIdOrder(ids) {
  if (!ids.length) return Promise.resolve([]);
  return prisma.product
    .findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      include: productListInclude,
    })
    .then((rows) => {
      const map = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => map.get(id)).filter(Boolean);
    });
}

async function listProductIdsByAvgRating(where, ascending, skip, take) {
  const allIds = await prisma.product.findMany({
    where,
    select: { id: true },
  });
  if (!allIds.length) return [];

  const groups = await prisma.review.groupBy({
    by: ["productId"],
    where: { product: where },
    _avg: { rating: true },
  });
  const avgMap = new Map(groups.map((g) => [g.productId, g._avg.rating ?? 0]));

  const sorted = allIds
    .map(({ id }) => ({ id, avg: Number(avgMap.get(id) ?? 0) }))
    .sort((a, b) =>
      ascending ? a.avg - b.avg || a.id.localeCompare(b.id) : b.avg - a.avg || a.id.localeCompare(b.id),
    );

  return sorted.slice(skip, skip + take).map((x) => x.id);
}

async function listProductIdsByPopularity(where, skip, take) {
  const allIds = await prisma.product.findMany({
    where,
    select: { id: true },
  });
  if (!allIds.length) return [];

  const groups = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { product: where },
    _sum: { quantity: true },
  });
  const popMap = new Map(groups.map((g) => [g.productId, g._sum.quantity ?? 0]));

  const sorted = allIds
    .map(({ id }) => ({ id, pop: Number(popMap.get(id) ?? 0) }))
    .sort((a, b) => b.pop - a.pop || a.id.localeCompare(b.id));

  return sorted.slice(skip, skip + take).map((x) => x.id);
}

async function listProductIdsByRelevance(where, term, skip, take) {
  const t = typeof term === "string" ? term.trim().toLowerCase() : "";
  if (!t) {
    const rows = await prisma.product.findMany({
      where,
      select: { id: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take,
    });
    return rows.map((r) => r.id);
  }

  const lite = await prisma.product.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      materials: true,
    },
  });

  function score(p) {
    const title = (p.title || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const mat = (p.materials || []).join(" ").toLowerCase();
    if (title === t) return 1000;
    if (title.startsWith(t)) return 800;
    if (title.includes(t)) return 600;
    if (cat.includes(t)) return 400;
    if (mat.includes(t)) return 350;
    if (desc.includes(t)) return 200;
    return 0;
  }

  const sorted = lite.sort(
    (a, b) => score(b) - score(a) || (a.title || "").localeCompare(b.title || ""),
  );
  return sorted.slice(skip, skip + take).map((x) => x.id);
}

function findPublishedProductSuggestions(term, perKind) {
  const contains = { contains: term, mode: "insensitive" };
  return Promise.all([
    prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ title: contains }, { category: contains }],
      },
      select: { id: true, title: true, category: true },
      take: perKind,
    }),
    prisma.artisanProfile.findMany({
      where: {
        AND: [
          {
            user: {
              role: "ARTISAN",
              products: { some: { status: "PUBLISHED" } },
            },
          },
          {
            OR: [
              { shopName: contains },
              {
                user: {
                  OR: [{ firstName: contains }, { lastName: contains }],
                },
              },
            ],
          },
        ],
      },
      select: {
        shopName: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      take: perKind,
    }),
  ]);
}

async function findPublishedMaterialSuggestions(term, take) {
  const pattern = `%${term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT m AS value
    FROM products p,
    LATERAL unnest(p.materials) AS m
    WHERE p.status = 'PUBLISHED'
      AND m ILIKE ${pattern}
    LIMIT ${take}
  `;
  return rows.map((r) => r.value).filter(Boolean);
}

async function aggregateFacetCategories(where) {
  const rows = await prisma.product.groupBy({
    by: ["category"],
    where,
    _count: { _all: true },
    orderBy: { category: "asc" },
  });
  return rows
    .filter((r) => r.category)
    .map((r) => ({ value: r.category, count: r._count._all }));
}

async function aggregateFacetMaterials(where) {
  const rows = await prisma.product.findMany({
    where,
    select: { materials: true },
  });
  const counts = new Map();
  for (const row of rows) {
    for (const m of row.materials || []) {
      if (!m) continue;
      counts.set(m, (counts.get(m) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => a.value.localeCompare(b.value));
}

async function aggregateFacetRegions(where) {
  const rows = await prisma.product.findMany({
    where,
    select: {
      artisan: {
        select: {
          artisanProfile: { select: { region: true } },
        },
      },
    },
  });
  const counts = new Map();
  for (const row of rows) {
    const region = row.artisan?.artisanProfile?.region;
    if (!region) continue;
    counts.set(region, (counts.get(region) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => a.value.localeCompare(b.value));
}

const PRICE_BUCKETS = [
  { label: "Under $50", min: 0, max: 50 },
  { label: "$50 – $100", min: 50, max: 100 },
  { label: "$100 – $200", min: 100, max: 200 },
  { label: "$200 – $350", min: 200, max: 350 },
  { label: "$350+", min: 350, max: null },
];

async function aggregatePriceBuckets(where) {
  const rows = await prisma.product.findMany({
    where,
    select: { price: true },
  });
  const prices = rows.map((r) => Number(r.price));

  return PRICE_BUCKETS.map((bucket) => {
    let count = 0;
    for (const p of prices) {
      if (bucket.max == null) {
        if (p >= bucket.min) count += 1;
      } else if (p >= bucket.min && p < bucket.max) {
        count += 1;
      }
    }
    const keyMax = bucket.max == null ? "max" : bucket.max;
    return {
      id: `${bucket.min}-${keyMax}`,
      label: bucket.label,
      minPrice: bucket.min,
      maxPrice: bucket.max,
      count,
    };
  }).filter((b) => b.count > 0);
}

module.exports = {
  listPublishedProducts,
  countPublishedProducts,
  findPublishedProductByIdOrSlug,
  listRelatedPublishedProducts,
  hasDeliveredOrderForProduct,
  createReview,
  listPublishedProductsInIdOrder,
  listProductIdsByAvgRating,
  listProductIdsByPopularity,
  listProductIdsByRelevance,
  findPublishedProductSuggestions,
  findPublishedMaterialSuggestions,
  aggregateFacetCategories,
  aggregateFacetMaterials,
  aggregateFacetRegions,
  aggregatePriceBuckets,
};
