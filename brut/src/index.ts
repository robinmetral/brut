import { copy, emptyDir } from "fs-extra";
import { cwd } from "process";
import buildPosts from "./buildPosts";
import buildPages from "./buildPages";

const OUT_DIR = `${cwd()}/dist`;
const PUBLIC_DIR = `${cwd()}/public`;

async function moveFiles() {
  try {
    await copy(PUBLIC_DIR, OUT_DIR);
  } catch (error) {
    console.error(error);
  }
}

async function init() {
  console.time("Total build time");
  await emptyDir(OUT_DIR);
  await Promise.all([moveFiles(), buildPosts(), buildPages()]);
  console.timeEnd("Total build time");
}

init();
