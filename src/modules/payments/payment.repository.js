const prisma = require("../../config/prisma");

function createPayment(data) {
  return prisma.payment.create({
    data,
    include: {
      order: true,
    },
  });
}

function findPaymentById(paymentId) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });
}

function findPaymentByTxRef(txRef) {
  return prisma.payment.findUnique({
    where: { txRef },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });
}

function updatePayment(paymentId, data) {
  return prisma.payment.update({
    where: { id: paymentId },
    data,
    include: {
      order: true,
    },
  });
}

function createWebhookEvent(data) {
  return prisma.paymentWebhookEvent.create({
    data,
  });
}

function updateWebhookEvent(eventId, data) {
  return prisma.paymentWebhookEvent.update({
    where: { id: eventId },
    data,
  });
}

module.exports = {
  createPayment,
  findPaymentById,
  findPaymentByTxRef,
  updatePayment,
  createWebhookEvent,
  updateWebhookEvent,
};
