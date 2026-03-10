const express = require("express");
const upload = require("../../config/upload");
const roles = require("../../constants/roles");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const productController = require("./product.controller");
const {
  createDraftSchema,
  updateDraftSchema,
  submitDraftSchema,
  reviewDraftSchema,
} = require("./product.validation");

const router = express.Router();

router.use(authenticate);

router.get("/artisan/products/drafts", authorize(roles.ARTISAN), productController.listDrafts);
router.post("/artisan/products/drafts", authorize(roles.ARTISAN), validate(createDraftSchema), productController.createDraft);
router.get("/artisan/products/drafts/:draftId", authorize(roles.ARTISAN), productController.getDraft);
router.patch(
  "/artisan/products/drafts/:draftId",
  authorize(roles.ARTISAN),
  validate(updateDraftSchema),
  productController.updateDraft,
);
router.post(
  "/artisan/products/drafts/:draftId/images",
  authorize(roles.ARTISAN),
  upload.array("images", 6),
  productController.uploadDraftImages,
);
router.post(
  "/artisan/products/drafts/:draftId/submit",
  authorize(roles.ARTISAN),
  validate(submitDraftSchema),
  productController.submitDraft,
);
router.patch(
  "/verifications/products/drafts/:draftId/review",
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT),
  validate(reviewDraftSchema),
  productController.reviewDraft,
);
router.patch(
  "/admin/products/:productId/publish",
  authorize(roles.ADMIN),
  productController.publishProduct,
);

module.exports = router;
