import fs from "fs-extra";
import { cwd } from "process";
import moveFiles from "./moveFiles";
import buildPages from "./buildPages";

const { emptyDir } = fs;

/**
 * @typedef {Object} ConfigObject
 * @property {string} [pagesDir] The top-level directory containing pages. Defaults to `/pages`.
 * @property {string} [templatesDir] The top-level directory containing templates. Defaults to `/templates`.
 * @property {string} [partialsDir] The top-level directory containing partials. Defaults to `/partials`.
 * @property {string} [publicDir] The top-level directory containing static assets to copy to the `outDir`. Defaults to `/public`.
 * @property {string} [outDir] The top-level directory for the build output. Defaults to `/dist`.
 */
/** @typedef {Required<ConfigObject>} Config */

/**
 * @returns {Promise<Required<ConfigObject>>}
 */
async function getConfig() {
  const { default: configObject } = await import(`${cwd()}/brut.config.js`);
  const config = {
    pagesDir: configObject.pagesDir
      ? `${cwd()}${configObject.pagesDir}`
      : `${cwd()}/pages`,
    templatesDir: configObject.templatesDir
      ? `${cwd()}${configObject.templatesDir}`
      : `${cwd()}/templates`,
    partialsDir: configObject.partialsDir
      ? `${cwd()}${configObject.partialsDir}`
      : `${cwd()}/partials`,
    publicDir: configObject.publicDir
      ? `${cwd()}${configObject.publicDir}`
      : `${cwd()}/public`,
    outDir: configObject.outDir
      ? `${cwd()}${configObject.outDir}`
      : `${cwd()}/dist`,
  };
  return config;
}

/**
 * @returns {Promise<void>}
 */
async function init() {
  console.time("Total build time");
  const config = await getConfig();
  await emptyDir(config.outDir);
  await Promise.all([moveFiles(config), buildPages(config)]);
  console.timeEnd("Total build time");
}

init();
