/** @typedef {import('.').Config} Config */

import { cp } from "node:fs/promises";

/**
 * @param {Config} config
 * @returns {Promise<void>}
 */
async function moveFiles({ publicDir, outDir }) {
  try {
    console.time("Moving static files");
    await cp(publicDir, outDir, { recursive: true });
    console.timeEnd("Moving static files");
  } catch (error) {
    console.error(error);
  }
}

export default moveFiles;
