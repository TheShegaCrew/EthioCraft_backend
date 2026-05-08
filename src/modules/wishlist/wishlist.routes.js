const express = require("express");
const roles = require("../../constants/roles");
const { authorize } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const wishlistController = require("./wishlist.controller");
const {
  addWishlistItemSchema,
  toggleWishlistItemSchema,
  wishlistProductParamsSchema,
} = require("./wishlist.validation");

const router = express.Router();

router.use(authorize(roles.CUSTOMER));

router.get("/", wishlistController.listWishlistItems);
router.get("/count", wishlistController.getWishlistCount);
router.post("/", validate(addWishlistItemSchema), wishlistController.addToWishlist);
router.post("/toggle", validate(toggleWishlistItemSchema), wishlistController.toggleWishlistItem);
router.get("/:productId", validate(wishlistProductParamsSchema), wishlistController.checkWishlistItem);
router.delete("/:productId", validate(wishlistProductParamsSchema), wishlistController.removeFromWishlist);
router.delete("/", wishlistController.clearWishlist);

module.exports = router;
