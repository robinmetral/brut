import fs from "fs-extra";
import type { Config } from ".";
import { getFiles } from "./buildPages";
import { execSync } from "child_process";

const { copy } = fs;

async function processCss({ stylesDir, outDir }: Config) {
  try {
    const paths = await getFiles(stylesDir);
    await Promise.all(
      paths.map(async (path) => {
        /**
         * Executes a git command in a Node.js child process, to get the commit
         * hash of the last revision of the file.
         */
        const lastRev = execSync(`git rev-list -1 --abbrev-commit HEAD ${path}`)
          .toString()
          .trim(); // will be `""` if the file hasn't been committed yet
        const relPath = path.replace(stylesDir, "");
        await copy(
          path,
          `${outDir}${relPath.replace(".css", `-${lastRev || "nohash"}.css`)}`
        );
      })
    );
  } catch (error) {
    console.error(error);
  }
}

export default processCss;
