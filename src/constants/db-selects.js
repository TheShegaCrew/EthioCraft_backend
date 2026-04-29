const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
  artisanProfile: {
    select: {
      id: true,
      shopName: true,
      bio: true,
      region: true,
      city: true,
      verificationStatus: true,
      culturalMetadata: true,
      extensionData: true,
    },
  },
};

const draftInclude = {
  media: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  artisan: {
    select: publicUserSelect,
  },
  reviewer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
};

const productInclude = {
  media: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  artisan: {
    select: publicUserSelect,
  },
  verifier: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  draft: {
    include: {
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
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
};

const orderInclude = {
  shippingAddress: true,
  customer: {
    select: publicUserSelect,
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
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
            },
          },
        },
      },
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
  },
};

module.exports = {
  publicUserSelect,
  draftInclude,
  productInclude,
  orderInclude,
};
