const express = require("express");
const upload = require("../../config/upload");
const roles = require("../../constants/roles");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const productController = require("./product.controller");
const {
  createDraftSchema,
  updateSampleSchema,
  updateDraftSchema,
  submitDraftSchema,
  reviewDraftSchema,
  createSampleSchema,
  reviewSampleSchema,
  adminSampleParamsSchema,
  adminProductParamsSchema,
  updateAdminProductSchema,
} = require("./product.validation");

const router = express.Router();

router.use(authenticate);
router.get("/artisan/products/drafts", authorize(roles.ARTISAN), productController.listDrafts);
// Only admins may create drafts (prevent direct artisan writes)
router.post("/admin/products/drafts", authorize(roles.ADMIN), validate(createDraftSchema), productController.createDraft);
router.get("/artisan/products/drafts/:draftId", authorize(roles.ARTISAN), productController.getDraft);
// Verification agents update drafts and upload verified media
router.get(
  "/verifications/products/drafts",
  authorize(roles.VERIFICATION_AGENT, roles.ADMIN),
  productController.listDraftsAdmin,
);
router.patch(
  "/verifications/products/drafts/:draftId",
  authorize(roles.VERIFICATION_AGENT, roles.ADMIN),
  validate(updateDraftSchema),
  productController.updateDraft,
);
router.get(
  "/verifications/products/drafts/:draftId",
  authorize(roles.VERIFICATION_AGENT, roles.ADMIN),
  productController.getDraftAdmin,
);
router.post(
  "/verifications/products/drafts/:draftId/images",
  authorize(roles.VERIFICATION_AGENT),
  upload.array("images", 6),
  productController.uploadDraftImages,
);
// Admin may submit a draft for final processing
router.post(
  "/admin/products/drafts/:draftId/submit",
  authorize(roles.ADMIN),
  validate(submitDraftSchema),
  productController.submitDraft,
);

// Samples endpoints (artisan uploads samples; returns sampleId)
router.get("/artisan/products/samples", authorize(roles.ARTISAN), productController.listSamples);
router.post("/artisan/products/samples", authorize(roles.ARTISAN), validate(createSampleSchema), productController.createSample);
router.get("/artisan/products/samples/:sampleId", authorize(roles.ARTISAN), productController.getSample);
router.patch(
  "/artisan/products/samples/:sampleId",
  authorize(roles.ARTISAN),
  validate(updateSampleSchema),
  productController.updateSample,
);
router.post(
  "/artisan/products/samples/:sampleId/images",
  authorize(roles.ARTISAN),
  upload.array("images", 6),
  productController.uploadSampleImages,
);

// Admin reviews samples (approve -> creates product_draft from sample)
router.get("/admin/products/samples", authorize(roles.ADMIN), productController.listAllSamples);
router.get("/admin/products/samples/:sampleId", authorize(roles.ADMIN), productController.getSampleAdmin);
router.patch(
  "/admin/products/samples/:sampleId/review",
  authorize(roles.ADMIN),
  validate(reviewSampleSchema),
  productController.reviewSample,
);

// Admin can explicitly create a draft from a sample (alternate flow)
router.post(
  "/admin/products/samples/:sampleId/drafts",
  authorize(roles.ADMIN),
  productController.createDraftFromSample,
);

router.delete(
  "/admin/products/samples/:sampleId",
  authorize(roles.ADMIN),
  validate(adminSampleParamsSchema),
  productController.deleteSampleAdmin,
);

router.patch(
  "/verifications/products/drafts/:draftId/review",
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT),
  validate(reviewDraftSchema),
  productController.reviewDraft,
);
router.get(
  "/admin/products/:productId",
  authorize(roles.ADMIN),
  validate(adminProductParamsSchema),
  productController.getAdminProduct,
);
router.patch(
  "/admin/products/:productId",
  authorize(roles.ADMIN),
  validate(updateAdminProductSchema),
  productController.updateAdminProduct,
);
router.patch(
  "/admin/products/:productId/publish",
  authorize(roles.ADMIN),
  productController.publishProduct,
);
router.delete(
  "/admin/products/:productId",
  authorize(roles.ADMIN),
  validate(adminProductParamsSchema),
  productController.deleteAdminProduct,
);

module.exports = router;
