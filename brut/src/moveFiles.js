/** @typedef {import('.').Config} Config */

import fs from "fs-extra";

const { copy } = fs;

/**
 * @param {Config} config
 * @returns {Promise<void>}
 */
async function moveFiles({ publicDir, outDir }) {
  try {
    console.time("Moving static files");
    await copy(publicDir, outDir);
    console.timeEnd("Moving static files");
  } catch (error) {
    console.error(error);
  }
}

export default moveFiles;
