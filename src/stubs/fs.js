// Stub for fs module - not needed when using in-memory file system
const notAvailable = (name) => () => {
  throw new Error(`fs.${name} not available in this environment`);
};

export const readFileSync = notAvailable("readFileSync");
export const writeFileSync = notAvailable("writeFileSync");
export const existsSync = () => false;
export const readdirSync = () => [];
export const statSync = notAvailable("statSync");
export const lstatSync = notAvailable("lstatSync");
export const mkdirSync = () => {};
export const unlinkSync = () => {};
export const rmdirSync = () => {};
export const realpathSync = Object.assign(notAvailable("realpathSync"), {
  native: notAvailable("realpathSync.native"),
});
export const watchFile = () => {};
export const unwatchFile = () => {};

// fs/promises exports
export const readFile = () => Promise.reject(new Error("fs.readFile not available"));
export const writeFile = () => Promise.reject(new Error("fs.writeFile not available"));
export const mkdir = () => Promise.resolve();
export const stat = () => Promise.reject(new Error("fs.stat not available"));

export default {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  lstatSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
  realpathSync,
  watchFile,
  unwatchFile,
  readFile,
  writeFile,
  mkdir,
  stat,
};
