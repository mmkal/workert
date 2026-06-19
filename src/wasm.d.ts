declare module "*.wasm" {
  const wasmModule: WebAssembly.Module | string;
  export default wasmModule;
}

declare module "*.wasm?module" {
  const wasmModule: WebAssembly.Module | string;
  export default wasmModule;
}
