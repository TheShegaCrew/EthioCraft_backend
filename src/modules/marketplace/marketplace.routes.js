const express = require("express");
const marketplaceController = require("./marketplace.controller");

const router = express.Router();

router.get("/products", marketplaceController.listProducts);
router.get("/products/:productIdOrSlug", marketplaceController.getProductDetails);

module.exports = router;
