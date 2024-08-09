/** @typedef {import('.').Config} Config */

import fs from "fs-extra";
import { resolve } from "path";
import { cwd } from "process";
import { load } from "js-yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import mustache from "mustache";
import { minify as minifier } from "html-minifier-terser";

const { writeFile, readFile, readdir, ensureDir } = fs;

/** @typedef {Object<string, string>} Frontmatter */

/**
 * Extracts frontmatter with `---` or `<!-- -->` delimiters from a string.
 * Inspired by vfile-matter: https://github.com/vfile/vfile-matter/
 * @param {string} file
 * @returns {{
 *   frontmatter: Frontmatter;
 *   content: string;
 * }}
 */
function extractFrontmatter(file) {
  const match =
    /^(?:---|<!--)(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?(?:---|-->)(?:\r?\n|\r|$)/.exec(
      file
    );
  if (match) {
    const frontmatter = /** @type {Frontmatter} */ (load(match[1]));
    const content = file.slice(match[0].length);
    return { frontmatter, content };
  } else {
    return { frontmatter: {}, content: file };
  }
}

/**
 * Parse the file into an AST, transform with unified plugins,
 * and convert back into html.
 * @param {string} file
 * @returns {Promise<string>}
 */
function processMarkdown(file) {
  return (
    unified()
      /**
       * `remark-parse` parses the markdown source to mdast.
       * https://github.com/remarkjs/remark/tree/main/packages/remark-parse
       */
      .use(remarkParse)
      /**
       * `remark-gfm` adds support for GitHub Flavored Markdown, including
       * tables and footnotes.
       * https://github.com/remarkjs/remark-gfm
       */
      .use(remarkGfm)
      /**
       * `remark-rehype` transforms the mdast into hast.
       * https://github.com/remarkjs/remark-rehype
       */
      .use(remarkRehype, { allowDangerousHtml: true })
      /**
       * `rehype-stringify` transforms the hast into HTML.
       * https://github.com/rehypejs/rehype/tree/main/packages/rehype-stringify
       */
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(file)
      .then((vfile) => String(vfile))
  );
}

/**
 * Minify an HTML string using html-minifier-terser.
 * @param {string} html
 * @returns {Promise<string>}
 */
async function minify(html) {
  return minifier(html, {
    collapseWhitespace: true,
    removeComments: true,
    collapseBooleanAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    minifyJS: true,
  });
}

/**
 * Reads files in the given partials dir and returns their contents as a
 * key-value object: `{ [slug]: contents }`
 * @param {string} partialsDir
 * @returns {Promise<Object.<string, string>>}
 */
async function loadPartials(partialsDir) {
  try {
    const partialsFiles = await readdir(partialsDir);
    if (partialsFiles.length < 1) {
      // empty partials dir
      return null;
    }
    let partials = /** @type {Object.<string, string>} */ ({});
    await Promise.all(
      partialsFiles.map(async (partialFile) => {
        const partialSlug = partialFile.split(".")[0]; // strip the extension
        const partial = await readFile(`${partialsDir}/${partialFile}`, "utf8");
        partials[partialSlug] = partial;
      })
    );
    console.log(partials);
    return partials;
  } catch (error) {
    // no partials dir
    return null;
  }
}

/**
 * Get the page's build script and run it on the html.
 * @param {string} content html content
 * @param {Frontmatter} frontmatter
 * @param {string} path page slug (for `/posts/first.html`, this would be `/posts/first/`)
 * @param {string} templatesDir config path to the templates directory
 * @param {string} partialsDir config path to the partials directory
 * @returns {Promise<string>}
 */
async function buildPage(
  content,
  frontmatter,
  path,
  templatesDir,
  partialsDir
) {
  // 1. inject into the template
  const hasTemplate = !!frontmatter.template;
  if (hasTemplate) {
    const template = await readFile(
      `${templatesDir}/${frontmatter.template}`,
      "utf8"
    );
    const partials = await loadPartials(partialsDir);
    content = mustache.render(
      template,
      frontmatter, // variables a.k.a. view
      { content, ...partials } // partials
    );
  }
  // 2. run build script
  const hasScript = !!frontmatter.buildScript;
  if (hasScript) {
    const script = await import(cwd() + frontmatter.buildScript);
    content = await script.buildPage(content, frontmatter, path);
  }
  // 3. minify and return
  return minify(content);
}

/**
 * Recursively list files in a directory
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return files.flat();
}

/**
 * @param {Config} config
 * @returns {Promise<void>}
 */
export default async function buildPages({
  outDir: outDirRoot,
  pagesDir,
  templatesDir,
  partialsDir,
}) {
  try {
    const paths = await getFiles(pagesDir);
    await Promise.all(
      paths.map(async (path) => {
        // only process markdown or html pages
        if (path.endsWith(".md") || path.endsWith(".html")) {
          // 1. extract frontmatter and content from file
          const file = await readFile(path, "utf-8");
          const { frontmatter, content } = extractFrontmatter(file);
          // 2. parse markdown into HTML
          let html = content;
          if (path.endsWith(".md")) {
            html = await processMarkdown(content);
          }
          // 3. pretty urls
          const isIndexFile =
            path.endsWith("/index.html") || path.endsWith("index.md");
          let outDir = `${outDirRoot}${path.replace(pagesDir, "")}`;
          if (isIndexFile) {
            outDir = outDir.replace("/index.html", "").replace("/index.md", "");
          } else {
            outDir = outDir.replace(".md", "").replace(".html", "");
          }
          // 4. build page and write to fs
          const relPath = outDir.replace(outDirRoot, "");
          const result = await buildPage(
            html,
            frontmatter,
            relPath,
            templatesDir,
            partialsDir
          );
          // TEMP: handle 404 pages for Cloudflare Pages
          if (outDir === `${outDirRoot}/404`) {
            await writeFile(`${outDir}.html`, result);
          } else {
            await ensureDir(outDir);
            await writeFile(`${outDir}/index.html`, result);
          }
        }
      })
    );
  } catch (error) {
    console.error(error);
  }
}
