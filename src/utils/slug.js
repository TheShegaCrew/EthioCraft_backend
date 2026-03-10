const slugify = require("slugify");

function buildSlug(value) {
  return slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  });
}

module.exports = {
  buildSlug,
};
