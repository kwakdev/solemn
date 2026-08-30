import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("dist/server", {
  recursive: true,
});

await build({
  entryPoints: [resolve("server/index.js")],
  outfile: resolve("dist/server/index.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["worker", "browser"],
});
