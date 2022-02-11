import fs from "fs-extra";
import { cwd } from "process";
import mustache from "mustache";
import klaw from "klaw";
import { minify } from "./utils";
import type { Config } from ".";

const { pathExists, readdir, writeFile, readFile } = fs;

/**
 * Get the page's build script and run it on the html.
 */
async function buildPage(file: string, scriptPath: string): Promise<string> {
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

export default async function buildPages({ outDir, pagesDir }: Config) {
  try {
    /**
     * 1. parse all files in /pages (maintain tree structure)
     * 2. process markdown into HTML (keep frontmatter as vars)
     * 3. process HTML with build script (keep comment-frontmatter as vars)
     * 4. inject HTML in template with vars
     */

    /**
     * Alternative klaw API:
     *
     * const files: klaw.Item[] = [];
     * klaw(pagesDir)
     *  .on("data", (item) => files.push(item))
     *  .on("end", () => console.log(JSON.stringify(files, null, 2)));
     */

    const template = await readFile(`${cwd()}/templates/default.html`, "utf-8");

    for await (const file of klaw(pagesDir)) {
      if (file.path.endsWith(".md")) {
        // TODO parse md into HTML
        console.log("Markdown file ignored: " + file.path);
      } else if (file.path.endsWith(".html")) {
        const rawFile = await readFile(file.path, "utf-8");
        const scriptPath = `${file.path.replace(".html", ".js")}`;
        const content = await buildPage(rawFile, scriptPath);
        const document = buildDocument(template, content);
        const minifiedDocument = await minify(document);
        const outPath = `${outDir}${file.path.replace(pagesDir, "")}`;
        await writeFile(outPath, minifiedDocument);
      } else {
        console.log("Path ignored: " + file.path);
      }
    }

    // await Promise.all(
    //   files
    //     .filter((file) => file.endsWith(".html"))
    //     .map(async function (fileName) {
    //       const file = await readFile(`${pagesDir}/${fileName}`, "utf-8");
    //       const scriptPath = `${pagesDir}/${fileName.replace(".html", ".js")}`;
    //       const content = await buildPage(file, scriptPath);
    //       const document = buildDocument(template, content);
    //       const minifiedDocument = await minify(document);
    //       await writeFile(`${outDir}/${fileName}`, minifiedDocument); // TODO nested pages
    //     })
    // );
  } catch (error) {
    console.error(error);
  }
}
