require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  hfApiKey: process.env.HF_API_KEY,
};