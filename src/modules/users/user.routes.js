const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const userController = require("./user.controller");
const {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
} = require("./user.validation");

const router = express.Router();

router.use(authenticate);

router.get("/me", userController.getProfile);
router.patch("/me", validate(updateProfileSchema), userController.updateProfile);
router.get("/me/addresses", userController.listAddresses);
router.post("/me/addresses", validate(createAddressSchema), userController.createAddress);
router.patch("/me/addresses/:addressId", validate(updateAddressSchema), userController.updateAddress);
router.delete("/me/addresses/:addressId", userController.deleteAddress);

module.exports = router;
