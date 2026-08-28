// Populates appsail-deploy/ with a minimal, self-contained copy of the
// backend (compiled dist/ + a package.json listing only runtime deps) so
// `catalyst deploy` zips just the backend instead of the whole monorepo.
// Run `npm run build` before this so dist/ is up to date.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const deployDir = path.join(root, "appsail-deploy");
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

fs.rmSync(path.join(deployDir, "dist"), { recursive: true, force: true });
fs.cpSync(path.join(root, "dist"), path.join(deployDir, "dist"), { recursive: true });

fs.writeFileSync(
  path.join(deployDir, "package.json"),
  JSON.stringify(
    {
      name: "fix-my-ride-appsail",
      version: rootPkg.version,
      private: true,
      main: "dist/server.js",
      engines: rootPkg.engines,
      dependencies: rootPkg.dependencies,
    },
    null,
    2
  ) + "\n"
);

console.log("appsail-deploy/ is ready (dist/ + package.json).");
