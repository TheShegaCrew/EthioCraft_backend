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

async function listArtisanDrafts(artisanId) {
  return productRepository.listDraftsByArtisan(artisanId);
}

async function getArtisanDraft(artisanId, draftId) {
  const draft = await productRepository.findDraftById(draftId);
  ensureDraftOwnership(draft, artisanId);
  return draft;
}

async function updateDraft(artisanId, draftId, payload) {
  const draft = await productRepository.findDraftById(draftId);
  ensureDraftOwnership(draft, artisanId);
  ensureDraftEditable(draft);

  return productRepository.updateDraft(draftId, mapDraftPayload(payload, { partial: true }));
}

async function uploadDraftImages(artisanId, draftId, files) {
  const draft = await productRepository.findDraftById(draftId);
  ensureDraftOwnership(draft, artisanId);
  ensureDraftEditable(draft);

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

async function submitDraft(artisanId, draftId, payload) {
  const draft = await productRepository.findDraftById(draftId);
  ensureDraftOwnership(draft, artisanId);
  ensureDraftEditable(draft);

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

module.exports = {
  createDraft,
  listArtisanDrafts,
  getArtisanDraft,
  updateDraft,
  uploadDraftImages,
  submitDraft,
  reviewDraft,
  publishProduct,
};
