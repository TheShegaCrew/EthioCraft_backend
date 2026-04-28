const asyncHandler = require("../../utils/asyncHandler");
const marketplaceService = require("./marketplace.service");

const listProducts = asyncHandler(async (req, res) => {
  const result = await marketplaceService.listProducts(req.query);

  res.status(200).json({
    message: "Marketplace products fetched successfully.",
    data: result,
  });
});

const getProductDetails = asyncHandler(async (req, res) => {
  const product = await marketplaceService.getProductDetails(req.params.productIdOrSlug);

  res.status(200).json({
    message: "Marketplace product fetched successfully.",
    data: product,
  });
});

const createProductReview = asyncHandler(async (req, res) => {
  const review = await marketplaceService.createProductReview(req.params.productIdOrSlug, req.user?.id, req.body);

  res.status(201).json({
    message: "Product review submitted successfully.",
    data: review,
  });
});

module.exports = {
  listProducts,
  getProductDetails,
  createProductReview,
};
