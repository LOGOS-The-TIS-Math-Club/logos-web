import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

const [packageManifest, releaseManifest, releaseConfig] = await Promise.all([
  readJson("../package.json"),
  readJson("../.release-please-manifest.json"),
  readJson("../release-please-config.json"),
]);

const rootPackage = releaseConfig.packages?.["."];

assert.equal(packageManifest.version, "0.0.0");
assert.deepEqual(releaseManifest, {});
assert.equal(rootPackage?.["release-type"], "node");
assert.equal(rootPackage?.["initial-version"], "0.1.0");
assert.equal(rootPackage?.["bump-minor-pre-major"], true);

console.log(
  "Release Please bootstrap verified: manifest 0.0.0, first release 0.1.0.",
);
