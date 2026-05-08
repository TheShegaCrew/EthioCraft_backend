const { withCache } = require("../../config/cache");
const { Prisma } = require("@prisma/client");
const ApiError = require("../../utils/apiError");
const { getPagination } = require("../../utils/pagination");
const marketplaceRepository = require("./marketplace.repository");

/** Express may yield a string or string[] for repeated query keys (or comma-separated). */
function normalizeListParam(value) {
  if (value == null || value === "") return [];
  const chunks = Array.isArray(value) ? value : [value];
  return chunks
    .flatMap((chunk) =>
      typeof chunk === "string" ? chunk.split(",") : [String(chunk)],
    )
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildFilters(query) {
  const andParts = [{ status: "PUBLISHED" }];

  if (query.search) {
    andParts.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { category: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }

  if (query.category) {
    andParts.push({
      category: { equals: query.category, mode: "insensitive" },
    });
  }

  if (query.artisanId) {
    andParts.push({ artisanId: query.artisanId });
  }

  if (query.tag) {
    andParts.push({ tags: { has: query.tag } });
  }

  const priceFilter = {};
  if (query.minPrice) priceFilter.gte = Number(query.minPrice);
  if (query.maxPrice) priceFilter.lte = Number(query.maxPrice);
  if (Object.keys(priceFilter).length) {
    andParts.push({ price: priceFilter });
  }

  const regions = normalizeListParam(query.region);
  if (regions.length) {
    andParts.push({
      artisan: {
        artisanProfile: {
          region: { in: regions },
        },
      },
    });
  }

  const materials = normalizeListParam(query.material);
  if (materials.length) {
    andParts.push({
      OR: materials.map((material) => ({ materials: { has: material } })),
    });
  }

  return andParts.length === 1 ? andParts[0] : { AND: andParts };
}

/** Base filters for facets: drop one dimension so counts reflect sibling filters. */
function buildFiltersExcluding(query, exclude) {
  const q = { ...query };
  if (exclude.includes("category")) delete q.category;
  if (exclude.includes("material")) delete q.material;
  if (exclude.includes("region")) delete q.region;
  if (exclude.includes("price")) {
    delete q.minPrice;
    delete q.maxPrice;
  }
  return buildFilters(q);
}

function buildSort(sortBy) {
  switch (sortBy) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "oldest":
      return { publishedAt: "asc" };
    case "newest":
      return { publishedAt: "desc" };
    default:
      return { publishedAt: "desc" };
  }
}

function usesCustomOrdering(sortBy, searchTerm) {
  if (sortBy === "rating_desc" || sortBy === "rating_asc" || sortBy === "popularity") return true;
  if (sortBy === "relevance" && searchTerm && String(searchTerm).trim()) return true;
  return false;
}

async function listProducts(query) {
  const pagination = getPagination(query);
  const where = buildFilters(query);
  const searchRaw = typeof query.search === "string" ? query.search : "";
  const orderBy = buildSort(query.sortBy);
  const custom = usesCustomOrdering(query.sortBy, searchRaw);
  const cacheKey = `marketplace:products:${JSON.stringify({
    where,
    orderBy: custom ? query.sortBy : orderBy,
    pagination,
    relevanceTerm: query.sortBy === "relevance" ? searchRaw : undefined,
  })}`;

  return withCache(cacheKey, 60, async () => {
    const total = await marketplaceRepository.countPublishedProducts(where);

    let items;
    if (custom) {
      let ids;
      if (query.sortBy === "rating_asc") {
        ids = await marketplaceRepository.listProductIdsByAvgRating(
          where,
          true,
          pagination.skip,
          pagination.limit,
        );
      } else if (query.sortBy === "rating_desc") {
        ids = await marketplaceRepository.listProductIdsByAvgRating(
          where,
          false,
          pagination.skip,
          pagination.limit,
        );
      } else if (query.sortBy === "popularity") {
        ids = await marketplaceRepository.listProductIdsByPopularity(where, pagination.skip, pagination.limit);
      } else {
        ids = await marketplaceRepository.listProductIdsByRelevance(
          where,
          searchRaw,
          pagination.skip,
          pagination.limit,
        );
      }
      items = await marketplaceRepository.listPublishedProductsInIdOrder(ids);
    } else {
      items = await marketplaceRepository.listPublishedProducts(
        where,
        orderBy,
        pagination.skip,
        pagination.limit,
      );
    }

    return {
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1,
      },
    };
  });
}

function suggestionRank(term, label) {
  const t = term.toLowerCase();
  const l = label.toLowerCase();
  if (l === t) return 100;
  if (l.startsWith(t)) return 80;
  if (l.includes(t)) return 60;
  return 40;
}

function dedupeSuggestions(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const k = `${row.kind}:${row.label.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

async function searchSuggestions(query) {
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const limitCap = Number(query.limit);
  const limit = Math.min(Number.isFinite(limitCap) ? limitCap : 8, 20);
  if (q.length < 2) {
    return { items: [], meta: { limit } };
  }

  const perKind = Math.ceil(limit / 4) + 2;
  const [productHits, artisans] =
    await marketplaceRepository.findPublishedProductSuggestions(q, perKind);
  const materialValues = await marketplaceRepository.findPublishedMaterialSuggestions(q, perKind);

  const rows = [];

  for (const p of productHits) {
    rows.push({
      kind: "product",
      label: p.title,
      productId: p.id,
      category: p.category,
      score: suggestionRank(q, p.title) + 5,
    });
  }

  for (const row of artisans) {
    const shop = (row.shopName || "").trim();
    const artisanName =
      `${row.user?.firstName || ""} ${row.user?.lastName || ""}`.trim();
    const labelPrimary = shop || artisanName || "Artisan";

    rows.push({
      kind: "artisan",
      label: shop ? `${shop} (${artisanName})` : artisanName,
      artisanId: row.user?.id,
      score: suggestionRank(q, shop) + suggestionRank(q, artisanName) * 0.5,
    });
  }

  for (const m of materialValues) {
    rows.push({
      kind: "material",
      label: String(m),
      score: suggestionRank(q, String(m)) + 2,
    });
  }

  const unique = dedupeSuggestions(rows);
  unique.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return {
    items: unique.slice(0, limit),
    meta: { limit, query: q },
  };
}

async function getProductFacets(query) {
  const cacheKey = `marketplace:facets:${JSON.stringify(query)}`;

  return withCache(cacheKey, 45, async () => {
    const [categoriesWhere, materialsWhere, regionsWhere, priceWhere] = [
      buildFiltersExcluding(query, ["category"]),
      buildFiltersExcluding(query, ["material"]),
      buildFiltersExcluding(query, ["region"]),
      buildFiltersExcluding(query, ["price"]),
    ];

    const [categories, materials, regions, priceRanges] = await Promise.all([
      marketplaceRepository.aggregateFacetCategories(categoriesWhere),
      marketplaceRepository.aggregateFacetMaterials(materialsWhere),
      marketplaceRepository.aggregateFacetRegions(regionsWhere),
      marketplaceRepository.aggregatePriceBuckets(priceWhere),
    ]);

    return {
      categories: categories.filter((x) => x.count > 0),
      materials: materials.filter((x) => x.count > 0),
      regions: regions.filter((x) => x.count > 0),
      priceRanges,
    };
  });
}

async function getProductDetails(identifier) {
  const product = await marketplaceRepository.findPublishedProductByIdOrSlug(identifier);

  if (!product) {
    throw new ApiError(404, "Published product was not found.");
  }

  const averageRating = product.reviews.length
    ? Number(
        (
          product.reviews.reduce((total, review) => total + review.rating, 0) / product.reviews.length
        ).toFixed(1),
      )
    : null;

  const relatedProducts = await marketplaceRepository.listRelatedPublishedProducts({
    category: product.category,
    excludeProductId: product.id,
    take: 3,
  });

  return {
    ...product,
    averageRating,
    relatedProducts,
  };
}

async function createProductReview(identifier, customerId, payload) {
  if (!customerId) {
    throw new ApiError(401, "Authentication required.");
  }

  const rating = Number(payload?.rating);
  const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be an integer from 1 to 5.");
  }

  if (!comment) {
    throw new ApiError(400, "Review comment is required.");
  }

  const product = await marketplaceRepository.findPublishedProductByIdOrSlug(identifier);
  if (!product) {
    throw new ApiError(404, "Published product was not found.");
  }

  const deliveredOrder = await marketplaceRepository.hasDeliveredOrderForProduct({
    productId: product.id,
    customerId,
  });

  if (!deliveredOrder) {
    throw new ApiError(403, "Only customers with delivered orders can review this product.");
  }

  try {
    return await marketplaceRepository.createReview({
      productId: product.id,
      customerId,
      rating,
      comment,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "You have already submitted a review for this product.");
    }
    throw error;
  }
}

module.exports = {
  listProducts,
  getProductDetails,
  createProductReview,
  searchSuggestions,
  getProductFacets,
};
