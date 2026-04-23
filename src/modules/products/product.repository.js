const prisma = require("../../config/prisma");
const { draftInclude, productInclude } = require("../../constants/db-selects");

async function createDraft(artisanId, data) {
  const draft = await prisma.productDraft.create({
    data: {
      artisanId,
      ...data,
    },
    include: draftInclude,
  });

  return {
    ...draft,
    draftId: draft.id,
    artisan: draft.artisan ? { ...draft.artisan, draftId: draft.id } : draft.artisan,
  };
}

function listDraftsByArtisan(artisanId) {
  return prisma.productDraft.findMany({
    where: { artisanId },
    include: draftInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

function findDraftById(draftId) {
  return prisma.productDraft.findUnique({
    where: { id: draftId },
    include: draftInclude,
  });
}

function updateDraft(draftId, data) {
  return prisma.productDraft.update({
    where: { id: draftId },
    data,
    include: draftInclude,
  });
}

function createDraftMedia(data) {
  return prisma.media.createMany({
    data,
  });
}

async function createSample(artisanId, data) {
  const sample = await prisma.sample.create({
    data: {
      artisanId,
      ...data,
    },
  });

  return sample;
}

function listSamplesByArtisan(artisanId) {
  return prisma.sample.findMany({
    where: { artisanId },
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
      },
      artisan: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

function findSampleById(sampleId) {
  return prisma.sample.findUnique({
    where: { id: sampleId },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      artisan: true,
    },
  });
}

function updateSample(sampleId, data) {
  return prisma.sample.update({
    where: { id: sampleId },
    data,
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      artisan: true,
    },
  });
}

function createSampleMedia(data) {
  return prisma.media.createMany({ data });
}

function listAllSamples() {
  return prisma.sample.findMany({
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      artisan: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function createDraftFromSample(sampleId, overrides = {}, actorId = null) {
  return prisma.$transaction(async (tx) => {
    const sample = await tx.sample.findUnique({ where: { id: sampleId }, include: { media: true } });

    if (!sample) return null;

    const draftData = {
      artisanId: sample.artisanId,
      sampleId: sample.id,
      title: overrides.title ?? sample.title,
      description: overrides.description ?? sample.description,
      category: overrides.category ?? sample.category ?? "",
      price: overrides.price ?? sample.price ?? 0,
      currency: overrides.currency ?? sample.currency ?? "ETB",
      stock: overrides.stock ?? sample.stock ?? 0,
      materials: overrides.materials ?? sample.materials ?? [],
      tags: overrides.tags ?? sample.tags ?? [],
      dimensions: overrides.dimensions ?? sample.dimensions,
      culturalMetadata: overrides.culturalMetadata ?? sample.culturalMetadata,
      extensionData: overrides.extensionData ?? sample.extensionData,
      status: "DRAFT",
    };

    const draft = await tx.productDraft.create({ data: draftData, include: draftInclude });

    if (sample.media?.length) {
      await tx.media.createMany({
        data: sample.media.map((media) => ({
          ownerType: "PRODUCT_DRAFT",
          kind: media.kind,
          draftId: draft.id,
          url: media.url,
          mimeType: media.mimeType,
          size: media.size,
          altText: media.altText,
          sortOrder: media.sortOrder,
        })),
      });
    }

    await tx.sample.update({ where: { id: sampleId }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: actorId } });

    return tx.productDraft.findUnique({ where: { id: draft.id }, include: draftInclude });
  });
}

function findProductById(productId) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: productInclude,
  });
}

function findProductByDraftId(draftId) {
  return prisma.product.findUnique({
    where: { draftId },
    include: productInclude,
  });
}

function updateProduct(productId, data) {
  return prisma.product.update({
    where: { id: productId },
    data,
    include: productInclude,
  });
}

module.exports = {
  createDraft,
  listDraftsByArtisan,
  findDraftById,
  updateDraft,
  createDraftMedia,
  createSample,
  listSamplesByArtisan,
  findSampleById,
  updateSample,
  createSampleMedia,
  listAllSamples,
  findProductById,
  findProductByDraftId,
  updateProduct,
  createDraftFromSample,
};
