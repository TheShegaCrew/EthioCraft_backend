const prisma = require("../../config/prisma");
const { draftInclude, productInclude } = require("../../constants/db-selects");

function createDraft(artisanId, data) {
  return prisma.productDraft.create({
    data: {
      artisanId,
      ...data,
    },
    include: draftInclude,
  });
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
  findProductById,
  findProductByDraftId,
  updateProduct,
};
