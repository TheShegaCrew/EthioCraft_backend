const { withCache } = require("../../config/cache");
const ApiError = require("../../utils/apiError");
const { getPagination } = require("../../utils/pagination");
const marketplaceRepository = require("./marketplace.repository");

function buildFilters(query) {
  const where = {
    status: "PUBLISHED",
  };

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { category: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.category) {
    where.category = { equals: query.category, mode: "insensitive" };
  }

  if (query.artisanId) {
    where.artisanId = query.artisanId;
  }

  if (query.tag) {
    where.tags = { has: query.tag };
  }

  if (query.minPrice || query.maxPrice) {
    where.price = {};
  }

  if (query.minPrice) {
    where.price.gte = Number(query.minPrice);
  }

  if (query.maxPrice) {
    where.price.lte = Number(query.maxPrice);
  }

  return where;
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

  return {
    ...product,
    averageRating,
  };
}

module.exports = {
  listProducts,
  getProductDetails,
};
