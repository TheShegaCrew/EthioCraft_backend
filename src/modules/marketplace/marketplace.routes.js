const express = require("express");
const roles = require("../../constants/roles");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");
const marketplaceController = require("./marketplace.controller");

const router = express.Router();

router.get("/products/suggestions", marketplaceController.listSearchSuggestions);
router.get("/products/facets", marketplaceController.listProductFacets);
router.get("/products", marketplaceController.listProducts);
router.get("/products/:productIdOrSlug", marketplaceController.getProductDetails);
router.post(
  "/products/:productIdOrSlug/reviews",
  authenticate,
  authorize(roles.CUSTOMER),
  marketplaceController.createProductReview,
);

module.exports = router;
