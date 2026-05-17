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

  const updatePayload = { ...payload };

  if (updatePayload.artisanBankDetail && existingUser.role !== "ARTISAN") {
    throw new ApiError(400, "Only artisans can update bank details.");
  }

  if (updatePayload.artisanBankDetail) {
    const bankPayload = {
      ...(existingUser.artisanBankDetail || {}),
      ...updatePayload.artisanBankDetail,
    };
    delete bankPayload.id;
    delete bankPayload.artisanId;
    delete bankPayload.createdAt;
    delete bankPayload.updatedAt;
    updatePayload.artisanBankDetail = bankPayload;
  }

  if (updatePayload.artisanProfile?.extensionData) {
    const {
      bankName,
      accountNumber,
      accountHolderName,
      ...restExtensionData
    } = updatePayload.artisanProfile.extensionData;

    const hasBankFields = bankName || accountNumber || accountHolderName;
    if (hasBankFields) {
      if (existingUser.role !== "ARTISAN") {
        throw new ApiError(400, "Only artisans can update bank details.");
      }
      updatePayload.artisanBankDetail = {
        ...(existingUser.artisanBankDetail || {}),
        bankName,
        accountNumber,
        accountHolderName,
      };
    }

    const nextExtensionData = {
      ...(existingUser.artisanProfile?.extensionData || {}),
      ...restExtensionData,
    };

    updatePayload.artisanProfile = {
      ...updatePayload.artisanProfile,
      ...(Object.keys(nextExtensionData).length > 0
        ? { extensionData: nextExtensionData }
        : {}),
    };
  }

  return userRepository.updateProfile(userId, updatePayload);
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
