/** @typedef {import('.').Config} Config */

import fs from "fs-extra";

const { copy } = fs;

/**
 * @param {Config} config
 * @returns {Promise<void>}
 */
async function moveFiles({ publicDir, outDir }) {
  try {
    await copy(publicDir, outDir);
  } catch (error) {
    console.error(error);
  }
}

export default moveFiles;
