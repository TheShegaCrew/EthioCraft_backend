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

module.exports = {
  listPublishedProducts,
  countPublishedProducts,
  findPublishedProductByIdOrSlug,
  listRelatedPublishedProducts,
  hasDeliveredOrderForProduct,
  createReview,
};
