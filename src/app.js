const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const env = require("./config/env");
const apiRoutes = require("./routes");
const notFoundMiddleware = require("./middlewares/not-found.middleware");
const { errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.status(200).json({
    message: "API is healthy and running smoothly.",
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "ethiopian-handcraft-marketplace-api",
  });
});

app.use("/api/v1", apiRoutes);
app.use(notFoundMiddleware);
app.use(errorHandler);

module.exports = app;
