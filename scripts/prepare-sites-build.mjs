import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist/server", {
  recursive: true,
});

await build({
  entryPoints: ["././server/index.js"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["worker", "browser"],
});
