import fs from "fs-extra";
const { copy } = fs;
import buildPosts from "./build-posts";

async function process() {
  console.time("Moving static files");
  try {
    await copy("./public", "./dist", { overwrite: true });
  } catch (error) {
    console.error(error);
  }
  console.timeEnd("Moving static files");
  console.time("Building posts");
  try {
    await buildPosts();
  } catch (error) {
    console.error(error);
  }
  console.timeEnd("Building posts");
}

process();
