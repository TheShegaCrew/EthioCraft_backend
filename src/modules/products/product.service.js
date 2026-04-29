const prisma = require("../../config/prisma");
const { draftInclude, productInclude } = require("../../constants/db-selects");
const { clearCacheByPrefix } = require("../../config/cache");
const { buildSlug } = require("../../utils/slug");
const ApiError = require("../../utils/apiError");
const productRepository = require("./product.repository");
const notificationService = require("../notifications/notification.service");
const adminService = require("../admin/admin.service");

const EDITABLE_DRAFT_STATUSES = ["DRAFT", "REJECTED"];

function mapDraftPayload(payload, options = {}) {
  const partial = options.partial || false;
  const mapped = {};
  const fields = [
    "title",
    "description",
    "category",
    "price",
    "stock",
    "dimensions",
    "culturalMetadata",
    "extensionData",
  ];

  for (const field of fields) {
    if (payload[field] !== undefined) {
      mapped[field] = payload[field];
    }
  }

  if (payload.materials !== undefined) {
    mapped.materials = payload.materials;
  } else if (!partial) {
    mapped.materials = [];
  }

  if (payload.tags !== undefined) {
    mapped.tags = payload.tags;
  } else if (!partial) {
    mapped.tags = [];
  }

  return mapped;
}

function ensureDraftOwnership(draft, artisanId) {
  if (!draft || draft.artisanId !== artisanId) {
    throw new ApiError(404, "Product draft was not found.");
  }
}

function ensureDraftEditable(draft) {
  if (!EDITABLE_DRAFT_STATUSES.includes(draft.status)) {
    throw new ApiError(409, `Draft cannot be edited while in ${draft.status} status.`);
  }
}

async function createAuditLog(data) {
  try {
    await adminService.createAuditLog(data);
  } catch (_error) {
    // Audit logging should not block the product lifecycle.
  }
}

async function createDraft(artisanId, payload) {
  return productRepository.createDraft(artisanId, mapDraftPayload(payload));
}

async function createSample(artisanId, payload) {
  return productRepository.createSample(artisanId, mapDraftPayload(payload));
}

async function listArtisanSamples(artisanId) {
  return productRepository.listSamplesByArtisan(artisanId);
}

async function listAllSamples() {
  return productRepository.listAllSamples();
}

async function getArtisanSample(artisanId, sampleId) {
  const sample = await productRepository.findSampleById(sampleId);
  if (!sample || sample.artisanId !== artisanId) {
    throw new ApiError(404, "Product sample was not found.");
  }

  return sample;
}

async function getSampleById(sampleId) {
  const sample = await productRepository.findSampleById(sampleId);
  if (!sample) {
    throw new ApiError(404, "Product sample was not found.");
  }

  return sample;
}

async function uploadSampleImages(artisanId, sampleId, files) {
  const sample = await productRepository.findSampleById(sampleId);

  if (!sample || sample.artisanId !== artisanId) {
    throw new ApiError(404, "Product sample was not found.");
  }

  if (!files?.length) {
    throw new ApiError(400, "At least one image file must be provided.");
  }

  await productRepository.createSampleMedia(
    files.map((file, index) => ({
      ownerType: "SAMPLE",
      kind: "IMAGE",
      sampleId,
      url: `/uploads/products/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      altText: sample.title,
      sortOrder: sample.media.length + index,
    })),
  );

  return productRepository.findSampleById(sampleId);
}

async function updateSample(actor, sampleId, payload) {
  const sample = await productRepository.findSampleById(sampleId);

  if (!sample) {
    throw new ApiError(404, "Product sample was not found.");
  }

  if (actor.role === "ARTISAN") {
    if (sample.artisanId !== actor.id) {
      throw new ApiError(404, "Product sample was not found.");
    }

    if (sample.status === "APPROVED") {
      throw new ApiError(409, "Approved samples cannot be edited.");
    }
  }

  return productRepository.updateSample(sampleId, mapDraftPayload(payload, { partial: true }));
}

async function listArtisanDrafts(artisanId) {
  return productRepository.listDraftsByArtisan(artisanId);
}

async function getArtisanDraft(artisanId, draftId) {
  const draft = await productRepository.findDraftById(draftId);
  ensureDraftOwnership(draft, artisanId);
  return draft;
}

async function updateDraft(actor, draftId, payload) {
  const draft = await productRepository.findDraftById(draftId);

  if (!draft) {
    throw new ApiError(404, "Product draft was not found.");
  }

  if (actor.role === "ARTISAN") {
    ensureDraftOwnership(draft, actor.id);
    ensureDraftEditable(draft);
  } else {
    // Verification agents and admins may update drafts, but do not allow changes to already approved drafts
    if (draft.status === "APPROVED") {
      throw new ApiError(409, "Approved drafts cannot be edited.");
    }
  }

  return productRepository.updateDraft(draftId, mapDraftPayload(payload, { partial: true }));
}

async function uploadDraftImages(actor, draftId, files) {
  const draft = await productRepository.findDraftById(draftId);

  if (!draft) {
    throw new ApiError(404, "Product draft was not found.");
  }

  if (actor.role === "ARTISAN") {
    ensureDraftOwnership(draft, actor.id);
    ensureDraftEditable(draft);
  } else {
    if (draft.status === "APPROVED") {
      throw new ApiError(409, "Cannot upload images to an approved draft.");
    }
  }

  if (!files?.length) {
    throw new ApiError(400, "At least one image file must be provided.");
  }

  await productRepository.createDraftMedia(
    files.map((file, index) => ({
      ownerType: "PRODUCT_DRAFT",
      kind: "IMAGE",
      draftId,
      url: `/uploads/products/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      altText: draft.title,
      sortOrder: draft.media.length + index,
    })),
  );

  return productRepository.findDraftById(draftId);
}

async function submitDraft(actor, draftId, payload) {
  const draft = await productRepository.findDraftById(draftId);

  if (!draft) {
    throw new ApiError(404, "Product draft was not found.");
  }

  // If artisan submits, ensure ownership and editable status. Admins may submit drafts as part of workflow.
  if (actor.role === "ARTISAN") {
    ensureDraftOwnership(draft, actor.id);
    ensureDraftEditable(draft);
  }

  if (!draft.media.length) {
    throw new ApiError(400, "Upload at least one product image before submitting for verification.");
  }

  return productRepository.updateDraft(draftId, {
    status: "SUBMITTED",
    submissionNotes: payload.submissionNotes || null,
    submittedAt: new Date(),
    verificationNotes: null,
  });
}

async function createUniqueSlug(tx, title, fallbackId, existingSlug) {
  if (existingSlug) {
    return existingSlug;
  }

  const baseSlug = buildSlug(title) || `product-${fallbackId.slice(-6)}`;
  let counter = 0;
  let candidate = baseSlug;

  while (await tx.product.findUnique({ where: { slug: candidate } })) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }

  return candidate;
}

async function reviewDraft(reviewerId, draftId, payload) {
  const draft = await productRepository.findDraftById(draftId);

  if (!draft) {
    throw new ApiError(404, "Product draft was not found.");
  }

  if (draft.status !== "SUBMITTED") {
    throw new ApiError(409, "Only submitted drafts can be reviewed.");
  }

  const now = new Date();

  if (payload.decision === "REJECT") {
    const rejectedDraft = await prisma.$transaction(async (tx) => {
      const updatedDraft = await tx.productDraft.update({
        where: { id: draftId },
        data: {
          status: "REJECTED",
          verificationNotes: payload.notes || null,
          reviewedAt: now,
          reviewedById: reviewerId,
        },
        include: draftInclude,
      });

      await tx.notification.create({
        data: {
          userId: draft.artisanId,
          type: "PRODUCT_REJECTED",
          title: "Product verification rejected",
          message: `${draft.title} was rejected. Review the notes and resubmit the draft.`,
          metadata: {
            draftId,
            notes: payload.notes || null,
          },
        },
      });

      return updatedDraft;
    });

    await createAuditLog({
      actorId: reviewerId,
      action: "REJECT_PRODUCT",
      entityType: "PRODUCT_DRAFT",
      entityId: draftId,
      description: `Rejected draft ${draft.title}.`,
      metadata: {
        notes: payload.notes || null,
      },
    });

    return {
      draft: rejectedDraft,
      product: null,
    };
  }

  const approvedProduct = await prisma.$transaction(async (tx) => {
    const existingProduct = await tx.product.findUnique({
      where: { draftId },
    });

    const slug = await createUniqueSlug(tx, draft.title, draft.id, existingProduct?.slug);

    await tx.productDraft.update({
      where: { id: draftId },
      data: {
        status: "APPROVED",
        verificationNotes: payload.notes || null,
        reviewedAt: now,
        reviewedById: reviewerId,
      },
    });

    const productData = {
      artisanId: draft.artisanId,
      draftId,
      title: draft.title,
      slug,
      description: draft.description,
      category: draft.category,
      price: draft.price,
      currency: draft.currency,
      stock: draft.stock,
      materials: draft.materials,
      tags: draft.tags,
      dimensions: draft.dimensions,
      culturalMetadata: draft.culturalMetadata,
      extensionData: draft.extensionData,
      status: "APPROVED",
      approvedAt: now,
      verifiedById: reviewerId,
    };

    const product = existingProduct
      ? await tx.product.update({
          where: { id: existingProduct.id },
          data: productData,
        })
      : await tx.product.create({
          data: productData,
        });

    const draftMedia = await tx.media.findMany({
      where: { draftId },
      orderBy: {
        sortOrder: "asc",
      },
    });

    await tx.media.deleteMany({
      where: { productId: product.id },
    });

    if (draftMedia.length) {
      await tx.media.createMany({
        data: draftMedia.map((media) => ({
          ownerType: "PRODUCT",
          kind: media.kind,
          productId: product.id,
          url: media.url,
          mimeType: media.mimeType,
          size: media.size,
          altText: media.altText,
          sortOrder: media.sortOrder,
        })),
      });
    }

    await tx.notification.create({
      data: {
        userId: draft.artisanId,
        type: "PRODUCT_APPROVED",
        title: "Product approved",
        message: `${draft.title} has been approved and is ready to publish.`,
        metadata: {
          draftId,
          productId: product.id,
        },
      },
    });

    return tx.product.findUnique({
      where: { id: product.id },
      include: productInclude,
    });
  });

  await createAuditLog({
    actorId: reviewerId,
    action: "APPROVE_PRODUCT",
    entityType: "PRODUCT_DRAFT",
    entityId: draftId,
    description: `Approved draft ${draft.title}.`,
    metadata: {
      productId: approvedProduct.id,
    },
  });

  await clearCacheByPrefix("marketplace:products:");

  return {
    draft: await productRepository.findDraftById(draftId),
    product: approvedProduct,
  };
}

async function reviewSample(reviewerId, sampleId, payload) {
  const sample = await productRepository.findSampleById(sampleId);

  if (!sample) {
    throw new ApiError(404, "Product sample was not found.");
  }

  const now = new Date();

  if (payload.decision === "REJECT") {
    const updatedSample = await prisma.$transaction(async (tx) => {
      const updated = await tx.sample.update({
        where: { id: sampleId },
        data: { status: "REJECTED", reviewedAt: now, reviewedById: reviewerId },
      });

      await tx.notification.create({
        data: {
          userId: sample.artisanId,
          type: "PRODUCT_REJECTED",
          title: "Sample rejected",
          message: `${sample.title} was rejected. Review the notes and resubmit the sample.`,
          metadata: { sampleId, notes: payload.notes || null },
        },
      });

      return updated;
    });

    await createAuditLog({
      actorId: reviewerId,
      action: "REJECT_PRODUCT",
      entityType: "SAMPLE",
      entityId: sampleId,
      description: `Rejected sample ${sample.title}.`,
      metadata: { notes: payload.notes || null },
    });

    return { sample: updatedSample };
  }

  if (payload.decision === "REQUEST_MORE_INFO") {
    const updated = await productRepository.updateSample(sampleId, { status: "MORE_INFO_REQUESTED" });

    await notificationService.createNotification({
      userId: sample.artisanId,
      type: "GENERAL",
      title: "More info requested",
      message: `${sample.title} requires more information from you. Check review notes.`,
      metadata: { sampleId, notes: payload.notes || null },
    });

    await createAuditLog({
      actorId: reviewerId,
      action: "OTHER",
      entityType: "SAMPLE",
      entityId: sampleId,
      description: `Requested more info for sample ${sample.title}.`,
      metadata: { notes: payload.notes || null },
    });

    return { sample: updated };
  }

  // APPROVE -> create a product_draft from the sample
  const draft = await productRepository.createDraftFromSample(sampleId, {}, reviewerId);

  await createAuditLog({
    actorId: reviewerId,
    action: "APPROVE_PRODUCT",
    entityType: "SAMPLE",
    entityId: sampleId,
    description: `Approved sample ${sample.title} and created draft ${draft.id}.`,
    metadata: { draftId: draft.id },
  });

  await notificationService.createNotification({
    userId: sample.artisanId,
    type: "PRODUCT_APPROVED",
    title: "Sample approved",
    message: `${sample.title} has been approved and a product draft was created for verification.`,
    metadata: { sampleId, draftId: draft.id },
  });

  await clearCacheByPrefix("marketplace:products:");

  return { sample: await productRepository.findSampleById(sampleId), draft };
}

async function createDraftFromSample(actorId, sampleId, overrides = {}) {
  const draft = await productRepository.createDraftFromSample(sampleId, overrides, actorId);

  if (!draft) {
    throw new ApiError(404, "Sample not found or draft could not be created.");
  }

  await clearCacheByPrefix("marketplace:products:");

  return draft;
}

async function publishProduct(productId, actorId) {
  const product = await productRepository.findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Approved product was not found.");
  }

  if (product.status !== "APPROVED") {
    throw new ApiError(409, "Only approved products can be published.");
  }

  const publishedProduct = await productRepository.updateProduct(productId, {
    status: "PUBLISHED",
    publishedAt: new Date(),
  });

  await notificationService.createNotification({
    userId: publishedProduct.artisanId,
    type: "GENERAL",
    title: "Product published",
    message: `${publishedProduct.title} is now live in the marketplace.`,
    metadata: {
      productId: publishedProduct.id,
    },
  });

  if (actorId) {
    await createAuditLog({
      actorId,
      action: "PUBLISH_PRODUCT",
      entityType: "PRODUCT",
      entityId: publishedProduct.id,
      description: `Published product ${publishedProduct.title}.`,
      metadata: {
        draftId: publishedProduct.draftId,
      },
    });
  }

  await clearCacheByPrefix("marketplace:products:");

  return publishedProduct;
}

async function getAdminProduct(productId) {
  const product = await productRepository.findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  const [salesAgg, reviewAgg] = await Promise.all([
    prisma.orderItem.aggregate({
      where: {
        productId,
        order: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      _count: { _all: true },
    }),
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const draft = product.draft || null;
  const activity = [
    draft?.submittedAt ? `Draft submitted on ${new Date(draft.submittedAt).toLocaleDateString()}` : null,
    product.approvedAt ? `Approved on ${new Date(product.approvedAt).toLocaleDateString()}` : null,
    product.publishedAt ? `Published on ${new Date(product.publishedAt).toLocaleDateString()}` : null,
    product.updatedAt ? `Last updated on ${new Date(product.updatedAt).toLocaleDateString()}` : null,
  ].filter(Boolean);

  return {
    ...product,
    featured: Boolean(product.extensionData?.featured),
    analytics: {
      totalOrderItems: salesAgg._count._all || 0,
      totalUnitsSold: Number(salesAgg._sum.quantity || 0),
      totalRevenue: Number(salesAgg._sum.lineTotal || 0),
      totalReviews: reviewAgg._count._all || 0,
      averageRating: reviewAgg._avg.rating ? Number(reviewAgg._avg.rating) : null,
    },
    verification: {
      submittedAt: draft?.submittedAt || null,
      reviewedAt: draft?.reviewedAt || null,
      approvedAt: product.approvedAt || null,
      publishedAt: product.publishedAt || null,
      verificationNotes: draft?.verificationNotes || null,
      verifiedBy: product.verifier || null,
    },
    activity,
    riskAlerts: Array.isArray(product.extensionData?.riskAlerts) ? product.extensionData.riskAlerts : [],
  };
}

async function updateAdminProduct(productId, payload, actorId) {
  const product = await productRepository.findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  const nextExtensionData = payload.featured === undefined
    ? product.extensionData
    : {
        ...(product.extensionData || {}),
        featured: payload.featured,
      };

  const data = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.stock !== undefined ? { stock: payload.stock } : {}),
    ...(payload.materials !== undefined ? { materials: payload.materials } : {}),
    ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
    ...(payload.dimensions !== undefined ? { dimensions: payload.dimensions } : {}),
    ...(payload.culturalMetadata !== undefined ? { culturalMetadata: payload.culturalMetadata } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.status === "PUBLISHED" && !product.publishedAt ? { publishedAt: new Date() } : {}),
    ...(payload.status === "ARCHIVED" ? { publishedAt: product.publishedAt } : {}),
    ...(nextExtensionData !== undefined ? { extensionData: nextExtensionData } : {}),
  };

  const updated = await productRepository.updateProduct(productId, data);

  await createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "PRODUCT",
    entityId: productId,
    description: `Updated admin product ${product.title}.`,
    metadata: { payload },
  });

  await clearCacheByPrefix("marketplace:products:");

  return getAdminProduct(updated.id);
}

async function deleteAdminProduct(productId, actorId) {
  const product = await productRepository.findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  const archived = await productRepository.updateProduct(productId, {
    status: "ARCHIVED",
  });

  await createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "PRODUCT",
    entityId: productId,
    description: `Archived product ${product.title}.`,
    metadata: { previousStatus: product.status },
  });

  await clearCacheByPrefix("marketplace:products:");

  return archived;
}

module.exports = {
  createDraft,
  createSample,
  listArtisanSamples,
  getArtisanSample,
  listArtisanDrafts,
  getArtisanDraft,
  updateDraft,
  uploadDraftImages,
  updateSample,
  uploadSampleImages,
  submitDraft,
  reviewDraft,
  reviewSample,
  createDraftFromSample,
  publishProduct,
  getAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  listAllSamples,
  getSampleById,
};
