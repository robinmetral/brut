/** @typedef {import('.').Config} Config */

import fs from "fs-extra";
import { resolve, basename, extname } from "path";
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

/** @typedef {{[x: string]: string}} Frontmatter */

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
 * Get the page's build script and run it on the html.
 * @param {string} content html content
 * @param {Frontmatter} frontmatter
 * @param {string} path page slug (for `/posts/first.html`, this would be `/posts/first/`)
 * @param {{[x: string]: string}} templates key-value representation of all templates
 * @param {{[x: string]: string}} partials key-value representation of all partials
 * @returns {Promise<string>}
 */
async function buildPage(content, frontmatter, path, templates, partials) {
  // 1. inject into the template
  const hasTemplate = !!frontmatter.template;
  if (hasTemplate) {
    content = mustache.render(
      templates[frontmatter.template],
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
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map((dirent) => {
        const res = resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
      })
    );
    return files.flat();
  } catch {
    return null;
  }
}

/**
 * Loads templates from the filesystem and returns them as a key-value object
 * such as `{ default: "template-source" }`
 * @param {string} templatesDir
 * @returns {Promise<{[x: string]: string}>}
}
 */
async function loadTemplates(templatesDir) {
  const templatePaths = await getFiles(templatesDir);
  if (!templatePaths) {
    console.log("No templates found.");
    return null;
  }
  const templates = /** @type {{[x: string]: string}} */ ({});
  await Promise.all(
    templatePaths.map(async (templatePath) => {
      const templateName = basename(templatePath).replace(
        extname(templatePath),
        ""
      );
      const templateSource = await readFile(templatePath, "utf-8");
      templates[templateName] = templateSource;
    })
  );
  console.log(`Loaded ${templatePaths.length} templates.`);
  return templates;
}

/**
 * Loads partials from the filesystem and returns them as a key-value object
 * such as `{ nav: "partial-source" }`
 * @param {string} partialsDir
 * @returns {Promise<{[x: string]: string}>}
}
 */
async function loadPartials(partialsDir) {
  const partialPaths = await getFiles(partialsDir);
  if (!partialPaths) {
    console.log("No partials found.");
    return null;
  }
  const partials = /** @type {{[x: string]: string}} */ ({});
  await Promise.all(
    partialPaths.map(async (partialPath) => {
      const partialName = basename(partialPath).replace(
        extname(partialPath),
        ""
      );
      const partialSource = await readFile(partialPath, "utf-8");
      partials[partialName] = partialSource;
    })
  );
  console.log(`Loaded ${partialPaths.length} partials.`);
  return partials;
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
    const [templates, partials] = await Promise.all([
      loadTemplates(templatesDir),
      loadPartials(partialsDir),
    ]);

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
            templates,
            partials
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
