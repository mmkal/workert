// Stub for url module
export function fileURLToPath(url) {
  if (typeof url === "string") {
    if (url.startsWith("file://")) {
      return url.slice(7);
    }
    return url;
  }
  return url.pathname || "";
}

export function pathToFileURL(path) {
  return new URL(`file://${path}`);
}

export default { fileURLToPath, pathToFileURL };
