import * as esbuild from "esbuild";

const result = await esbuild.build({
  entryPoints: ["./src/compiler.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral", // Works in browser and edge runtimes
  target: "es2020",
  outfile: "dist/compiler.js",
  minify: true, // Keep readable for debugging; set to true for production
  metafile: true,

  // Required for neutral platform to resolve modules correctly
  mainFields: ["module", "main"],
  conditions: ["import", "default"],

  // Define globals that might be accessed
  define: {
    "process.env.NODE_ENV": '"production"',
  },

  // Provide a banner that sets up global shims for Node.js globals
  banner: {
    js: `
// Shims for Node.js globals
var __filename = "/compiler.js";
var __dirname = "/";
var process = globalThis.process || { cwd: () => "/", env: {} };
`,
  },

  // We need to handle Node.js built-ins that ts-morph dependencies might reference
  // The InMemoryFileSystem in @ts-morph/bootstrap should avoid actually using these
  alias: {
    fs: "./src/stubs/fs.js",
    "node:fs": "./src/stubs/fs.js",
    "node:fs/promises": "./src/stubs/fs.js",
    path: "path-browserify",
    "node:path": "path-browserify",
    os: "./src/stubs/os.js",
    "node:os": "./src/stubs/os.js",
    url: "./src/stubs/url.js",
    module: "./src/stubs/module.js",
  },

  // These are dynamically required by TypeScript but not needed at runtime
  // for our in-memory compilation use case
  external: ["inspector"],
});

// Print bundle size info
const outputs = Object.entries(result.metafile.outputs);
for (const [file, info] of outputs) {
  const sizeKB = (info.bytes / 1024).toFixed(1);
  const sizeMB = (info.bytes / 1024 / 1024).toFixed(2);
  console.log(`${file}: ${sizeKB} KB (${sizeMB} MB)`);
}

console.log("\nBundle created successfully!");
