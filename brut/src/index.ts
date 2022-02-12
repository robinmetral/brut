import fs from "fs-extra";
import { cwd } from "process";
import moveFiles from "./moveFiles";
import buildPages from "./buildPages";

const { emptyDir } = fs;

type ConfigObject = {
  /**
   * The top-level directory containing pages.
   * Defaults to `/pages`.
   */
  pagesDir?: string;
  /**
   * The top-level directory containing static assets to copy to the `outDir`.
   * Defaults to `/public`.
   */
  publicDir?: string;
  /**
   * The top-level directory for the build output.
   * Defaults to `/dist`.
   */
  outDir?: string;
};

export type Config = Required<ConfigObject>;

async function getConfig() {
  const { default: configObject } = await import(`${cwd()}/brut.config.js`);
  const config: Config = {
    pagesDir: configObject.pagesDir
      ? `${cwd()}${configObject.pagesDir}`
      : `${cwd()}/pages`,
    publicDir: configObject.publicDir
      ? `${cwd()}${configObject.publicDir}`
      : `${cwd()}/public`,
    outDir: configObject.outDir
      ? `${cwd()}${configObject.outDir}`
      : `${cwd()}/dist`,
  };
  return config;
}

async function init() {
  console.time("Total build time");
  const config = await getConfig();
  await emptyDir(config.outDir);
  await Promise.all([moveFiles(config), buildPages(config)]);
  console.timeEnd("Total build time");
}

init();
