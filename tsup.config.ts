import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    sourcemap: true,
    platform: "neutral",
    target: "es2022",
    minify: false,
    outDir: "lib",
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    treeshake: true,
  },
  {
    entry: ["src/index.ts"],
    globalName: "vcrsdk",
    sourcemap: true,
    platform: "browser",
    target: "es2022",
    minify: true,
    outDir: "lib",
    format: "iife",
    dts: false,
    clean: false,
    treeshake: true,
    esbuildPlugins: [
      {
        name: "resolve-node-polyfill",
        setup(build) {
          build.onResolve({ filter: /^node:/ }, (args) => ({
            path: args.path,
            namespace: "node-polyfill",
          }));
          build.onLoad({ filter: /.*/, namespace: "node-polyfill" }, () => ({
            contents: "export default undefined;",
          }));
        },
      },
    ],
  },
]);
