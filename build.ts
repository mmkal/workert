const result = await Bun.build({
  entrypoints: ["./src/compiler.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Print bundle size info
for (const output of result.outputs) {
  const sizeKB = (output.size / 1024).toFixed(1);
  const sizeMB = (output.size / 1024 / 1024).toFixed(2);
  console.log(`${output.path}: ${sizeKB} KB (${sizeMB} MB)`);
}

console.log("\nBundle created successfully!");

export {};
