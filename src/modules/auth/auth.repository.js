const prisma = require("../../config/prisma");
const { publicUserSelect } = require("../../constants/db-selects");

function findAuthUserByEmail(email) {
  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
    include: {
      artisanProfile: true,
    },
  });
}

function createUser(data) {
  return prisma.user.create({
    data,
    select: publicUserSelect,
  });
}

function findPublicUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}

module.exports = {
  findAuthUserByEmail,
  createUser,
  findPublicUserById,
};
