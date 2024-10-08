import { mkdir, rm } from "fs/promises";
import { cwd } from "process";
import moveFiles from "./moveFiles";
import buildPages from "./buildPages";

/**
 * @typedef {Object} ConfigObject
 * @property {string} [pagesDir] The top-level directory containing pages. Defaults to `/pages`.
 * @property {string} [templatesDir] The top-level directory containing templates. Defaults to `/templates`.
 * @property {string} [partialsDir] The top-level directory containing partials. Defaults to `/partials`.
 * @property {string} [publicDir] The top-level directory containing static assets to copy to the `outDir`. Defaults to `/public`.
 * @property {string} [outDir] The top-level directory for the build output. Defaults to `/dist`.
 * @property {string[]} [collections] Array of collections. Collection directories must be direct children of the `pagesDir`. Example: `["posts"]`.
 * @property {function} [processContext] A function that receives a context object for processing before it's handed over to mustache
 * @property {import('unified').Plugin[]} [remarkPlugins] An array of remark plugins
 * @property {import('unified').Plugin[]} [rehypePlugins] An array of rehype plugins
 */
/** @typedef {Required<ConfigObject>} Config */

/**
 * @returns {Promise<Required<ConfigObject>>}
 */
async function getConfig() {
  const { default: configObject } = await import(`${cwd()}/brut.config.js`);
  const config = /** @type {Config} */ ({
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
    processContext: configObject.processContext
      ? configObject.processContext
      : (context) => context,
    collections: configObject.collections || [],
    remarkPlugins: configObject.remarkPlugins || [],
    rehypePlugins: configObject.rehypePlugins || [],
  });
  return config;
}

/**
 * @returns {Promise<void>}
 */
async function init() {
  console.time("Total build time");
  const config = await getConfig();
  await rm(config.outDir, { recursive: true, force: true }); // force ignores the exception when dist doesn't exist (e.g. in CI)
  await mkdir(config.outDir);
  await Promise.all([moveFiles(config), buildPages(config)]);
  console.timeEnd("Total build time");
}

init();
