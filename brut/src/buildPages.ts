import { readdir, writeFile, readFile } from "fs/promises";
import { cwd } from "process";
import { pathExists } from "fs-extra";
import mustache from "mustache";
import { minify } from "./utils";

const PAGES_DIR = "./src/pages";
const OUT_DIR = "./dist";

/**
 * Get the page's build script and run it on the html.
 */
async function buildPage(file: string, fileName: string): Promise<string> {
  console.log(cwd());
  console.log(__dirname);
  const scriptPath = `${cwd()}/src/pages/${fileName.replace(".html", ".js")}`;
  const hasScript = await pathExists(scriptPath);
  if (hasScript) {
    const script = await import(scriptPath);
    return script.buildPage(file);
  } else {
    // if there's no build script we return the raw html
    return file;
  }
}

/**
 * Inject the html into a mustache template.
 */
function buildDocument(template: string, content: string) {
  return mustache.render(
    template,
    {}, // variables
    { content } // partials
  );
}

export default async function buildPages() {
  try {
    const files = await readdir(PAGES_DIR);
    const template = await readFile(`./src/templates/default.html`, "utf-8");
    await Promise.all(
      files
        .filter((file) => file.endsWith(".html"))
        .map(async function (fileName) {
          const file = await readFile(`${PAGES_DIR}/${fileName}`, "utf-8");
          const content = await buildPage(file, fileName);
          const document = buildDocument(template, content);
          const minifiedDocument = await minify(document);
          await writeFile(`${OUT_DIR}/${fileName}`, minifiedDocument);
        })
    );
  } catch (error) {
    console.error(error);
  }
}
