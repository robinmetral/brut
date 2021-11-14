#!/usr/bin/env node --experimental-specifier-resolution=node
import { copy, emptyDir } from "fs-extra";
import buildPosts from "./buildPosts";
import buildPages from "./buildPages";

async function moveFiles() {
  try {
    await copy("./public", "./dist");
  } catch (error) {
    console.error(error);
  }
}

async function init() {
  console.time("Total build time");
  await emptyDir("./dist");
  await Promise.all([moveFiles(), buildPosts(), buildPages()]);
  console.timeEnd("Total build time");
}

init();
