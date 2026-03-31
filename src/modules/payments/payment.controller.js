const asyncHandler = require("../../utils/asyncHandler");
const paymentService = require("./payment.service");
const paymentRepository = require("./payment.repository");

const initializePayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.initializePayment(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Payment initialized successfully.",
    data: payment,
  });
});

const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPayment(req.user, req.params.paymentId);

  res.status(200).json({
    message: "Payment fetched successfully.",
    data: payment,
  });
});

const confirmPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.confirmPayment(req.user, req.params.paymentId, req.validated.body);

  res.status(200).json({
    message: "Payment confirmation processed successfully.",
    data: payment,
  });
});

const telebirrWebhook = asyncHandler(async (req, res) => {
  const result = await paymentService.handleWebhook("TELEBIRR", req.validated.body, req.headers);

  res.status(200).json({
    message: "TeleBirr webhook processed.",
    data: result,
  });
});

const chapaWebhook = asyncHandler(async (req, res) => {
  const result = await paymentService.handleWebhook("CHAPA", req.validated.body, req.headers);

  res.status(200).json({
    message: "Chapa webhook processed.",
    data: result,
  });
});

const handleCallback = asyncHandler(async (req, res) => {
  const { tx_ref } = req.query;
  const payment = await paymentService.syncPaymentStatus(tx_ref);

  if (!payment) {
    return res.status(404).send("Payment not found");
  }

  if (payment.status === "SUCCESS") {
    return res.redirect("/payments/success");
  }
  return res.redirect("/payments/failure");
});

module.exports = {
  initializePayment,
  getPayment,
  confirmPayment,
  telebirrWebhook,
  chapaWebhook,
  handleCallback,
};
