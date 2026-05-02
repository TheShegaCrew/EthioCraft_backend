const asyncHandler = require("../../utils/asyncHandler");
const productService = require("./product.service");

const createDraft = asyncHandler(async (req, res) => {
  const draft = await productService.createDraft(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Product draft created successfully.",
    data: draft, 
  });
});

const createSample = asyncHandler(async (req, res) => {
  const sample = await productService.createSample(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Product sample created successfully.",
    data: { sampleId: sample.id },
  });
});

const deleteSampleAdmin = asyncHandler(async (req, res) => {
  const adminService = require("../admin/admin.service");

  await adminService.deleteSample(req.params.sampleId, req.user?.id);

  res.status(200).json({
    message: "Sample deleted successfully.",
  });
});

const listSamples = asyncHandler(async (req, res) => {
  const samples = await productService.listArtisanSamples(req.user.id);

  res.status(200).json({
    message: "Product samples fetched successfully.",
    data: samples,
  });
});

const listAllSamples = asyncHandler(async (req, res) => {
  const samples = await productService.listAllSamples();

  res.status(200).json({
    message: "All product samples fetched successfully.",
    data: samples,
  });
});

const getSample = asyncHandler(async (req, res) => {
  const sample = await productService.getArtisanSample(req.user.id, req.params.sampleId);

  res.status(200).json({
    message: "Product sample fetched successfully.",
    data: sample,
  });
});

const getSampleAdmin = asyncHandler(async (req, res) => {
  const sample = await productService.getSampleById(req.params.sampleId);

  res.status(200).json({
    message: "Product sample fetched successfully.",
    data: sample,
  });
});

const listDrafts = asyncHandler(async (req, res) => {
  const drafts = await productService.listArtisanDrafts(req.user.id);

  res.status(200).json({
    message: "Product drafts fetched successfully.",
    data: drafts,
  });
});

const listDraftsAdmin = asyncHandler(async (req, res) => {
  const drafts = await productService.listDraftsAdmin(req.query);

  res.status(200).json({
    message: "All product drafts fetched successfully.",
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

const getDraftAdmin = asyncHandler(async (req, res) => {
  const draft = await productService.getDraftById(req.params.draftId);

  res.status(200).json({
    message: "Product draft fetched successfully.",
    data: draft,
  });
});

const updateDraft = asyncHandler(async (req, res) => {
  const draft = await productService.updateDraft(req.user, req.params.draftId, req.validated.body);

  res.status(200).json({
    message: "Product draft updated successfully.",
    data: draft,
  });
});

const uploadDraftImages = asyncHandler(async (req, res) => {
  const draft = await productService.uploadDraftImages(req.user, req.params.draftId, req.files || []);

  res.status(200).json({
    message: "Product images uploaded successfully.",
    data: draft,
  });
});

const uploadSampleImages = asyncHandler(async (req, res) => {
  const sample = await productService.uploadSampleImages(req.user.id, req.params.sampleId, req.files || []);

  res.status(200).json({
    message: "Sample images uploaded successfully.",
    data: { sampleId: sample.id },
  });
});

const updateSample = asyncHandler(async (req, res) => {
  const sample = await productService.updateSample(req.user, req.params.sampleId, req.validated.body);

  res.status(200).json({
    message: "Product sample updated successfully.",
    data: sample,
  });
});

const submitDraft = asyncHandler(async (req, res) => {
  const draft = await productService.submitDraft(req.user, req.params.draftId, req.validated.body);

  res.status(200).json({
    message: "Product draft submitted for verification.",
    data: draft,
  });
});

const reviewSample = asyncHandler(async (req, res) => {
  const outcome = await productService.reviewSample(req.user.id, req.params.sampleId, req.validated.body);

  res.status(200).json({
    message: `Sample review completed with decision ${req.validated.body.decision}.`,
    data: outcome,
  });
});

const createDraftFromSample = asyncHandler(async (req, res) => {
  const draft = await productService.createDraftFromSample(req.user.id, req.params.sampleId, req.validated?.body || {});

  res.status(201).json({
    message: "Product draft created from sample successfully.",
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

const getAdminProduct = asyncHandler(async (req, res) => {
  const product = await productService.getAdminProduct(req.params.productId);

  res.status(200).json({
    message: "Admin product fetched successfully.",
    data: product,
  });
});

const updateAdminProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateAdminProduct(req.params.productId, req.validated.body, req.user.id);

  res.status(200).json({
    message: "Product updated successfully.",
    data: product,
  });
});

const deleteAdminProduct = asyncHandler(async (req, res) => {
  const product = await productService.deleteAdminProduct(req.params.productId, req.user.id);

  res.status(200).json({
    message: "Product archived successfully.",
    data: product,
  });
});

module.exports = {
  createDraft,
  createSample,
  listSamples,
  listDrafts,
  getSample,
  getDraft,
  updateDraft,
  uploadDraftImages,
  uploadSampleImages,
  submitDraft,
  reviewDraft,
  reviewSample,
  createDraftFromSample,
  getAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  publishProduct,
  listAllSamples,
  getSampleAdmin,
  updateSample,
  getDraftAdmin,
  listDraftsAdmin,
  deleteSampleAdmin,
};
