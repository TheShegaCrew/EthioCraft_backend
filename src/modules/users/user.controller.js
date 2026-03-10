const asyncHandler = require("../../utils/asyncHandler");
const userService = require("./user.service");

const getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.id);

  res.status(200).json({
    message: "Profile fetched successfully.",
    data: profile,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await userService.updateProfile(req.user.id, req.validated.body);

  res.status(200).json({
    message: "Profile updated successfully.",
    data: profile,
  });
});

const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.getAddresses(req.user.id);

  res.status(200).json({
    message: "Addresses fetched successfully.",
    data: addresses,
  });
});

const createAddress = asyncHandler(async (req, res) => {
  const address = await userService.addAddress(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Address created successfully.",
    data: address,
  });
});

const updateAddress = asyncHandler(async (req, res) => {
  const address = await userService.updateAddress(req.user.id, req.params.addressId, req.validated.body);

  res.status(200).json({
    message: "Address updated successfully.",
    data: address,
  });
});

const deleteAddress = asyncHandler(async (req, res) => {
  await userService.removeAddress(req.user.id, req.params.addressId);

  res.status(200).json({
    message: "Address deleted successfully.",
  });
});

module.exports = {
  getProfile,
  updateProfile,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
};
