const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return fullPath.endsWith(".js") ? [fullPath] : [];
  });
}

const files = [
  ...walk(path.join(process.cwd(), "src")),
  path.join(process.cwd(), "prisma", "seed.js"),
].filter((filePath) => fs.existsSync(filePath));

let hasErrors = false;

for (const filePath of files) {
  const result = spawnSync(process.execPath, ["--check", filePath], { stdio: "inherit" });

  if (result.status !== 0) {
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} files.`);
