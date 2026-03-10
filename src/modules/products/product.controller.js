const asyncHandler = require("../../utils/asyncHandler");
const productService = require("./product.service");

const createDraft = asyncHandler(async (req, res) => {
  const draft = await productService.createDraft(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Product draft created successfully.",
    data: draft,
  });
});

const listDrafts = asyncHandler(async (req, res) => {
  const drafts = await productService.listArtisanDrafts(req.user.id);

  res.status(200).json({
    message: "Product drafts fetched successfully.",
    data: drafts,
  });
});

const getDraft = asyncHandler(async (req, res) => {
  const draft = await productService.getArtisanDraft(req.user.id, req.params.draftId);

  res.status(200).json({
    message: "Product draft fetched successfully.",
    data: draft,
  });
});

const updateDraft = asyncHandler(async (req, res) => {
  const draft = await productService.updateDraft(req.user.id, req.params.draftId, req.validated.body);

  res.status(200).json({
    message: "Product draft updated successfully.",
    data: draft,
  });
});

const uploadDraftImages = asyncHandler(async (req, res) => {
  const draft = await productService.uploadDraftImages(req.user.id, req.params.draftId, req.files || []);

  res.status(200).json({
    message: "Product images uploaded successfully.",
    data: draft,
  });
});

const submitDraft = asyncHandler(async (req, res) => {
  const draft = await productService.submitDraft(req.user.id, req.params.draftId, req.validated.body);

  res.status(200).json({
    message: "Product draft submitted for verification.",
    data: draft,
  });
});

const reviewDraft = asyncHandler(async (req, res) => {
  const outcome = await productService.reviewDraft(req.user.id, req.params.draftId, req.validated.body);

  res.status(200).json({
    message: `Draft review completed with decision ${req.validated.body.decision}.`,
    data: outcome,
  });
});

const publishProduct = asyncHandler(async (req, res) => {
  const product = await productService.publishProduct(req.params.productId, req.user.id);

  res.status(200).json({
    message: "Product published successfully.",
    data: product,
  });
});

module.exports = {
  createDraft,
  listDrafts,
  getDraft,
  updateDraft,
  uploadDraftImages,
  submitDraft,
  reviewDraft,
  publishProduct,
};
