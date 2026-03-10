const userRepository = require("./user.repository");
const ApiError = require("../../utils/apiError");

async function getProfile(userId) {
  const user = await userRepository.findProfileById(userId);

  if (!user) {
    throw new ApiError(404, "User profile was not found.");
  }

  return user;
}

async function updateProfile(userId, payload) {
  const existingUser = await userRepository.findUserWithArtisanProfile(userId);

  if (!existingUser) {
    throw new ApiError(404, "User profile was not found.");
  }

  if (payload.artisanProfile && existingUser.role !== "ARTISAN") {
    throw new ApiError(400, "Only artisans can update artisan profile details.");
  }

  if (payload.artisanProfile && !existingUser.artisanProfile && !payload.artisanProfile.shopName) {
    throw new ApiError(400, "shopName is required when creating an artisan profile.");
  }

  return userRepository.updateProfile(userId, payload);
}

async function getAddresses(userId) {
  return userRepository.listAddresses(userId);
}

async function addAddress(userId, payload) {
  if (payload.isDefault) {
    await userRepository.clearDefaultAddresses(userId);
  }

  return userRepository.createAddress({
    ...payload,
    userId,
  });
}

async function updateAddress(userId, addressId, payload) {
  const address = await userRepository.findAddressById(addressId);

  if (!address || address.userId !== userId) {
    throw new ApiError(404, "Address was not found.");
  }

  if (payload.isDefault) {
    await userRepository.clearDefaultAddresses(userId, addressId);
  }

  return userRepository.updateAddress(addressId, payload);
}

async function removeAddress(userId, addressId) {
  const address = await userRepository.findAddressById(addressId);

  if (!address || address.userId !== userId) {
    throw new ApiError(404, "Address was not found.");
  }

  await userRepository.deleteAddress(addressId);
}

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  removeAddress,
};
