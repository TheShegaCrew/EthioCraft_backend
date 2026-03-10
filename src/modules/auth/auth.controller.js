const asyncHandler = require("../../utils/asyncHandler");
const authService = require("./auth.service");

const register = asyncHandler(async (req, res) => {
  const response = await authService.registerUser(req.validated.body);

  res.status(201).json({
    message: "User registered successfully.",
    data: response,
  });
});

const login = asyncHandler(async (req, res) => {
  const response = await authService.loginUser(req.validated.body);

  res.status(200).json({
    message: "Login successful.",
    data: response,
  });
});

module.exports = {
  register,
  login,
};
