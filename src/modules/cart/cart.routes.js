const express = require("express");
const roles = require("../../constants/roles");
const { authorize } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const cartController = require("./cart.controller");
const {
  addCartItemSchema,
  updateCartItemSchema,
  cartProductParamsSchema,
} = require("./cart.validation");

const router = express.Router();

router.use(authorize(roles.CUSTOMER));

router.get("/", cartController.getCart);
router.get("/count", cartController.getCartCount);
router.post("/", validate(addCartItemSchema), cartController.addToCart);
router.patch("/:productId", validate(updateCartItemSchema), cartController.updateCartItem);
router.delete("/:productId", validate(cartProductParamsSchema), cartController.removeFromCart);
router.delete("/", cartController.clearCart);

module.exports = router;
