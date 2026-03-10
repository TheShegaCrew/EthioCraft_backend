const ApiError = require("../utils/apiError");

module.exports = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    next(
      new ApiError(
        400,
        "Validation failed.",
        result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      ),
    );
    return;
  }

  req.validated = result.data;
  next();
};
