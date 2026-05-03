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

function buildSort(sortBy) {
  switch (sortBy) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "oldest":
      return { publishedAt: "asc" };
    default:
      return { publishedAt: "desc" };
  }
}

async function listProducts(query) {
  const pagination = getPagination(query);
  const where = buildFilters(query);
  const orderBy = buildSort(query.sortBy);
  const cacheKey = `marketplace:products:${JSON.stringify({ where, orderBy, pagination })}`;

  return withCache(cacheKey, 60, async () => {
    const [items, total] = await Promise.all([
      marketplaceRepository.listPublishedProducts(where, orderBy, pagination.skip, pagination.limit),
      marketplaceRepository.countPublishedProducts(where),
    ]);

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
};
