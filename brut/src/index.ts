import fs from "fs-extra";
import { cwd } from "process";
import moveFiles from "./moveFiles";
import buildPages from "./buildPages";
import buildPosts from "./buildPosts";

const { emptyDir } = fs;

type ConfigObject = {
  /**
   * The top-level directory containing markdown posts.
   * Defaults to `/src/posts`.
   */
  postsDir?: string;
  /**
   * The top-level directory containing pages.
   * Defaults to `/src/pages`.
   */
  pagesDir?: string;
  /**
   * The top-level directory containing static assets to copy to the root of
   * the built site.
   * Defaults to `/public`.
   */
  publicDir?: string;
  /**
   * The directory for the build output.
   * Defaults to `/dist`.
   */
  outDir?: string;
};

export type Config = Required<ConfigObject>;

async function getConfig() {
  const { default: configObject } = await import(`${cwd()}/brut.config.js`);
  const config: Config = {
    postsDir: configObject.postsDir
      ? `${cwd()}${configObject.postsDir}`
      : `${cwd()}/src/posts`,
    pagesDir: configObject.pagesDir
      ? `${cwd()}${configObject.pagesDir}`
      : `${cwd()}/src/pages`,
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
  await Promise.all([
    moveFiles(config),
    buildPages(config),
    // buildPosts(config),
  ]);
  console.timeEnd("Total build time");
}

init();
