import fs from "fs-extra";
import type { Config } from ".";

const { copy } = fs;

async function moveFiles({ publicDir, outDir }: Config) {
  try {
    await copy(publicDir, outDir);
  } catch (error) {
    console.error(error);
  }
}

export default moveFiles;
