const prisma = require("../../config/prisma");
const { draftInclude, productInclude } = require("../../constants/db-selects");
const { clearCacheByPrefix } = require("../../config/cache");
const { buildSlug } = require("../../utils/slug");
const ApiError = require("../../utils/apiError");
const productRepository = require("./product.repository");
const notificationService = require("../notifications/notification.service");
const adminService = require("../admin/admin.service");
const { resolveUploadedFileUrls } = require("../../utils/media-upload");

const EDITABLE_DRAFT_STATUSES = ["ADMIN_CREATED", "AGENT_IN_PROGRESS", "REJECTED"];

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
  const sample = await productRepository.createSample(artisanId, mapDraftPayload(payload));

  await notificationService.createNotification({
    userId: artisanId,
    type: "GENERAL",
    title: "Sample submitted",
    message: `${sample.title} was submitted for admin review.`,
    metadata: { sampleId: sample.id },
  });

  await notificationService.notifyAdmins({
    type: "GENERAL",
    title: "New Sample Submitted",
    message: `Sample '${sample.title}' has been submitted and is awaiting verification.`,
    metadata: { sampleId: sample.id },
  });

  return sample;
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

  const urls = await resolveUploadedFileUrls(files);

  await productRepository.createSampleMedia(
    urls.map((url, index) => ({
      ownerType: "SAMPLE",
      kind: "IMAGE",
      sampleId,
      url,
      mimeType: files[index].mimetype,
      size: files[index].size,
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

  const mapped = mapDraftPayload(payload, { partial: true });

  if (actor.role === "ARTISAN" && ["MORE_INFO_REQUESTED", "REJECTED"].includes(sample.status)) {
    mapped.status = "SUBMITTED";
    mapped.submittedAt = new Date();
  }

  return productRepository.updateSample(sampleId, mapped);
}

async function resubmitSample(artisanId, sampleId) {
  const sample = await productRepository.findSampleById(sampleId);

  if (!sample || sample.artisanId !== artisanId) {
    throw new ApiError(404, "Product sample was not found.");
  }

  if (sample.status === "APPROVED") {
    throw new ApiError(409, "Approved samples cannot be resubmitted.");
  }

  if (!["MORE_INFO_REQUESTED", "REJECTED", "SUBMITTED"].includes(sample.status)) {
    throw new ApiError(409, `Sample cannot be resubmitted while in ${sample.status} status.`);
  }

  if (!sample.media.length) {
    throw new ApiError(400, "Upload at least one product image before resubmitting.");
  }

  const updated = await productRepository.updateSample(sampleId, {
    status: "SUBMITTED",
    submittedAt: new Date(),
  });

  await notificationService.createNotification({
    userId: artisanId,
    type: "GENERAL",
    title: "Sample resubmitted",
    message: `${sample.title} was resubmitted for admin review.`,
    metadata: { sampleId },
  });

  await notificationService.notifyAdmins({
    type: "GENERAL",
    title: "Sample Resubmitted",
    message: `Sample '${sample.title}' was resubmitted and is awaiting verification.`,
    metadata: { sampleId },
  });

  return updated;
}


async function deleteArtisanSample(artisanId, sampleId) {
  const sample = await productRepository.findSampleById(sampleId);

  if (!sample || sample.artisanId !== artisanId) {
    throw new ApiError(404, "Product sample was not found.");
  }

  if (sample.status === "APPROVED") {
    throw new ApiError(409, "Approved samples cannot be deleted.");
  }

  const activeDraft = await prisma.productDraft.findFirst({
    where: {
      sampleId,
      status: { notIn: ["REJECTED"] },
    },
  });

  if (activeDraft) {
    throw new ApiError(409, "Cannot delete this sample while a verification draft is in progress.");
  }

  await prisma.sample.delete({ where: { id: sampleId } });

  return { deletedId: sampleId };
} 

async function listArtisanDrafts(artisanId, query = {}) {
  return productRepository.listDraftsByArtisan(artisanId, query);
}

async function listArtisanPublishedProducts(artisanId, query = {}) {
  return productRepository.listProductsByArtisan(artisanId, query);
}

async function listDraftsAdmin(query, user = null) {
  const { status, search, assigned } = query;
  const where = {};

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
      { artisan: { firstName: { contains: search, mode: "insensitive" } } },
      { artisan: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  // If requested, limit to drafts that originate from samples assigned to this verification agent
  if (assigned === 'true' && user && user.role === 'VERIFICATION_AGENT') {
    // Filter by related sample.assignedVerifierId === user.id
    where.sample = { assignedVerifierId: user.id };
  }

  return prisma.productDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      artisan: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          artisanProfile: {
            select: {
              region: true,
            },
          },
        },
      },
      media: {
        take: 1,
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

async function getArtisanDraft(artisanId, draftId) {
  const draft = await productRepository.findDraftById(draftId);
  ensureDraftOwnership(draft, artisanId);
  return draft;
}

async function getDraftById(draftId) {
  const draft = await productRepository.findDraftById(draftId);
  if (!draft) {
    throw new ApiError(404, "Product draft was not found.");
  }
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
    // Verification agents and admins may update drafts, but do not allow changes to already published drafts
    if (draft.status === "PUBLISHED") {
      throw new ApiError(409, "Published drafts cannot be edited.");
    }

    // Verification agents must be explicitly assigned to the originating sample for verification
    if (actor.role === "VERIFICATION_AGENT") {
      if (!draft.sampleId) {
        throw new ApiError(403, "You are not assigned to verify this draft.");
      }
      const sample = await productRepository.findSampleById(draft.sampleId);
      if (!sample || sample.assignedVerifierId !== actor.id) {
        throw new ApiError(403, "You are not assigned to verify this draft.");
      }
    }
  }

  const mapped = mapDraftPayload(payload, { partial: true });

  if (actor.role !== "ARTISAN" && payload.status !== undefined) {
    mapped.status = payload.status;
  }

  return productRepository.updateDraft(draftId, mapped);
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
    if (draft.status === "PUBLISHED") {
      throw new ApiError(409, "Cannot upload images to a published draft.");
    }

    // Verification agents must be assigned to the originating sample to upload verified media
    if (actor.role === "VERIFICATION_AGENT") {
      if (!draft.sampleId) {
        throw new ApiError(403, "You are not assigned to verify this draft.");
      }
      const sample = await productRepository.findSampleById(draft.sampleId);
      if (!sample || sample.assignedVerifierId !== actor.id) {
        throw new ApiError(403, "You are not assigned to verify this draft.");
      }
    }
  }

  if (!files?.length) {
    throw new ApiError(400, "At least one image file must be provided.");
  }

  const urls = await resolveUploadedFileUrls(files);

  await productRepository.createDraftMedia(
    urls.map((url, index) => ({
      ownerType: "PRODUCT_DRAFT",
      kind: "IMAGE",
      draftId,
      url,
      mimeType: files[index].mimetype,
      size: files[index].size,
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

  const updatedDraft = await productRepository.updateDraft(draftId, {
    status: "ADMIN_REVIEW",
    submissionNotes: payload.submissionNotes || null,
    submittedAt: new Date(),
    verificationNotes: null,
  });

  await notificationService.createNotification({
    userId: draft.artisanId,
    type: "PRODUCT_DRAFT_SUBMITTED",
    title: "Draft submitted for review",
    message: `${draft.title} has been submitted for verification.`,
    metadata: {
      draftId,
      notes: payload.submissionNotes || null,
    },
  });

  await notificationService.notifyAdmins({
    type: "GENERAL",
    title: "Draft Submitted for Review",
    message: `Product draft '${draft.title}' has been submitted for final admin review.`,
    metadata: { draftId },
  });

  return updatedDraft;
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

  if (draft.status !== "ADMIN_REVIEW" && draft.status !== "AGENT_VERIFIED") {
    throw new ApiError(409, "Only submitted drafts can be reviewed.");
  }

  // If reviewer is a verification agent, ensure they are assigned to the originating sample
  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (reviewer.role === "VERIFICATION_AGENT") {
    if (!draft.sampleId) {
      throw new ApiError(403, "You are not assigned to review this draft.");
    }
    const sample = await productRepository.findSampleById(draft.sampleId);
    if (!sample || sample.assignedVerifierId !== reviewerId) {
      throw new ApiError(403, "You are not assigned to review this draft.");
    }
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

  // When admin approves, auto-publish the product; verification agents only mark as approved
  const isAdminApproval = reviewer.role === "ADMIN";

  const approvedProduct = await prisma.$transaction(async (tx) => {
    const existingProduct = await tx.product.findUnique({
      where: { draftId },
    });

    const slug = await createUniqueSlug(tx, draft.title, draft.id, existingProduct?.slug);

    await tx.productDraft.update({
      where: { id: draftId },
      data: {
        status: "PUBLISHED",
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
      status: isAdminApproval ? "PUBLISHED" : "APPROVED",
      approvedAt: now,
      publishedAt: isAdminApproval ? now : null,
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

    const extensionMediaUrls = Array.isArray(draft.extensionData?.mediaFiles) ? draft.extensionData.mediaFiles : [];
    let currentSortOrder = draftMedia.length > 0 ? Math.max(...draftMedia.map(m => m.sortOrder)) + 1 : 0;
    
    const extensionMediaData = extensionMediaUrls.map((url) => {
      let kind = "IMAGE";
      const ext = (url.split('.').pop() || '').toLowerCase();
      if (['gltf', 'glb', 'obj', 'fbx', 'stl', 'ply', 'usdz'].includes(ext)) {
        kind = "MODEL_3D";
      } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
        kind = "VIDEO";
      }
      return {
        ownerType: "PRODUCT",
        kind: kind,
        productId: product.id,
        url: url,
        sortOrder: currentSortOrder++,
      };
    });

    const allMediaData = draftMedia.map((media) => ({
      ownerType: "PRODUCT",
      kind: media.kind,
      productId: product.id,
      url: media.url,
      mimeType: media.mimeType,
      size: media.size,
      altText: media.altText,
      sortOrder: media.sortOrder,
    })).concat(extensionMediaData);

    if (allMediaData.length) {
      await tx.media.createMany({
        data: allMediaData,
      });
    }

    const notificationTitle = isAdminApproval 
      ? "Product approved and published" 
      : "Product approved";
    const notificationMessage = isAdminApproval
      ? `${draft.title} has been approved and is now live in the marketplace.`
      : `${draft.title} has been verified and approved.`;

    await tx.notification.create({
      data: {
        userId: draft.artisanId,
        type: "PRODUCT_APPROVED",
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          draftId,
          productId: product.id,
        },
      },
    });

    return product;
  });

  // Verify product was created and all relationships are properly loaded
  if (!approvedProduct || !approvedProduct.id) {
    throw new ApiError(500, "Failed to create product from draft.");
  }

  const finalProduct = await productRepository.findProductById(approvedProduct.id);

  if (!finalProduct) {
    throw new ApiError(500, "Product was created but could not be retrieved.");
  }

  await createAuditLog({
    actorId: reviewerId,
    action: "APPROVE_PRODUCT",
    entityType: "PRODUCT_DRAFT",
    entityId: draftId,
    description: `Approved draft ${draft.title}${isAdminApproval ? " and published to marketplace" : ""}.`,
    metadata: {
      productId: finalProduct.id,
      published: isAdminApproval,
    },
  });

  await clearCacheByPrefix("marketplace:products:");

  return {
    draft: await productRepository.findDraftById(draftId),
    product: finalProduct,
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
    type: "PRODUCT_DRAFT_CREATED",
    title: "Verification draft created",
    message: `${sample.title} was approved. A product draft is now in the verification pipeline.`,
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

async function resolveProductByIdOrDraftId(identifier) {
  let product = await productRepository.findProductById(identifier);
  if (product) return product;

  return productRepository.findProductByDraftId(identifier);
}

async function publishProduct(productId, actorId) {
  const product = await resolveProductByIdOrDraftId(productId);

  if (!product) {
    throw new ApiError(404, "Approved product was not found.");
  }

  if (product.status !== "APPROVED") {
    throw new ApiError(409, "Only approved products can be published.");
  }

  const resolvedProductId = product.id;
  const publishedProduct = await productRepository.updateProduct(resolvedProductId, {
    status: "PUBLISHED",
    publishedAt: new Date(),
  });

  await notificationService.createNotification({
    userId: publishedProduct.artisanId,
    type: "PRODUCT_PUBLISHED",
    title: "Product published",
    message: `${publishedProduct.title} is now live in the marketplace.`,
    metadata: {
      productId: publishedProduct.id,
      draftId: publishedProduct.draftId,
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
  const product = await resolveProductByIdOrDraftId(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  const resolvedProductId = product.id;
  const [salesAgg, reviewAgg] = await Promise.all([
    prisma.orderItem.aggregate({
      where: {
        productId: resolvedProductId,
        order: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      _count: { _all: true },
    }),
    prisma.review.aggregate({
      where: { productId: resolvedProductId },
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
  const product = await resolveProductByIdOrDraftId(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  const resolvedProductId = product.id;
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

  const updated = await productRepository.updateProduct(resolvedProductId, data);

  await createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "PRODUCT",
    entityId: resolvedProductId,
    description: `Updated admin product ${product.title}.`,
    metadata: { payload },
  });

  await clearCacheByPrefix("marketplace:products:");

  return getAdminProduct(updated.id);
}

async function deleteAdminProduct(productId, actorId) {
  const product = await resolveProductByIdOrDraftId(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  const resolvedProductId = product.id;
  const archived = await productRepository.updateProduct(resolvedProductId, {
    status: "ARCHIVED",
  });

  await createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "PRODUCT",
    entityId: resolvedProductId,
    description: `Archived product ${product.title}.`,
    metadata: { previousStatus: product.status },
  });

  await clearCacheByPrefix("marketplace:products:");

  return archived;
}

async function verifyDraft(actor, draftId, payload) {
  const draft = await productRepository.findDraftById(draftId);

  if (!draft) {
    throw new ApiError(404, "Product draft was not found.");
  }

  // Verification agents must be assigned to the originating sample
  if (actor.role === "VERIFICATION_AGENT") {
    if (!draft.sampleId) {
      throw new ApiError(403, "You are not assigned to verify this draft.");
    }
    const sample = await productRepository.findSampleById(draft.sampleId);
    if (!sample || sample.assignedVerifierId !== actor.id) {
      throw new ApiError(403, "You are not assigned to verify this draft.");
    }
  }

  const updatedDraft = await productRepository.updateDraft(draftId, {
    status: "AGENT_VERIFIED",
    verificationNotes: payload.notes || null,
  });

  await notificationService.createNotification({
    userId: draft.artisanId,
    type: "GENERAL",
    title: "Draft verified by agent",
    message: `${draft.title} has been verified and is awaiting final admin review.`,
    metadata: {
      draftId,
      notes: payload.notes || null,
    },
  });

  await notificationService.notifyAdmins({
    type: "GENERAL",
    title: "Draft Verified by Agent",
    message: `Product draft '${draft.title}' has been verified and is ready for final review.`,
    metadata: { draftId },
  });

  return updatedDraft;
}

module.exports = {
  createDraft,
  createSample,
  listArtisanSamples,
  getArtisanSample,
  listArtisanDrafts,
  listArtisanPublishedProducts,
  getArtisanDraft,
  updateDraft,
  uploadDraftImages,
  updateSample,
  resubmitSample,
  deleteArtisanSample,
  uploadSampleImages,
  submitDraft,
  verifyDraft,
  reviewDraft,
  reviewSample,
  createDraftFromSample,
  publishProduct,
  getAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  listAllSamples,
  getSampleById,
  getDraftById,
  listDraftsAdmin,
};
