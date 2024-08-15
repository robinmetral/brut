/** @typedef {import('.').Config} Config */

import { writeFile, readFile, readdir, mkdir } from "fs/promises";
import { resolve, basename, extname, dirname } from "path";
import { cwd } from "process";
import { load } from "js-yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import mustache from "mustache";
import { minify } from "html-minifier-terser";

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
 * @param {import('unified').Plugin[]} remarkPlugins
 * @param {import('unified').Plugin[]} rehypePlugins
 * @returns {Promise<string>}
 */
function processMarkdown(file, remarkPlugins, rehypePlugins) {
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
       * Custom remark plugins, from brut.config.js
       */
      .use(remarkPlugins)
      /**
       * `remark-rehype` transforms the mdast into hast.
       * https://github.com/remarkjs/remark-rehype
       */
      .use(remarkRehype, { allowDangerousHtml: true })
      /**
       * `rehype-slug` adds ids to HTML headings.
       * https://github.com/rehypejs/rehype-slug
       */
      .use(rehypeSlug)
      /**
       * Custom rehype plugins, from brut.config.js
       */
      .use(rehypePlugins)
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
 * Removes whitespace from an HTML string using html-minifier-terser (and,
 * under the hood, terser for inline JS and clean-css for inline CSS).
 *
 * This isnt's minifying further because I want the build to resemble the
 * source (brut!). I want to be able to read, edit, debug code in the browser.
 * The build is slightly less optimized than it could be, yes. Don't worry
 * about it and go compress your images and gzip your files.
 *
 * TODO: how many more bytes are stripped when minifying more aggressively?
 * TODO: how much time does this add to the build? Should it be kept?
 *
 * @param {string} html
 * @returns {Promise<string>}
 */
async function removeWhitespace(html) {
  return minify(html, {
    collapseWhitespace: true,
    keepClosingSlash: true, // html-minifier-terser's only on-by-default option?
    minifyCSS: { level: 0 }, // clean-css options. This strips whitespaces but doesn't change anything else
    minifyJS: { mangle: false, compress: false }, // terser options. This strips whitespaces and formats JS using terser defaults (minor changes)
  });
}

/**
 * Get the page's build script and run it on the html.
 * @param {{
 *   page: Page;
 *   context: {pages: Page[]}
 *   templates: {[x: string]: string}
 *   partials: {[x: string]: string}
 * }} arguments
 * @returns {Promise<string>}
 */
async function buildPage({ page, context, templates, partials }) {
  let { frontmatter, content, slug } = page;
  let html = "";
  // 1. inject into the template
  const hasTemplate = !!frontmatter.template;
  if (hasTemplate) {
    html = mustache.render(
      templates[frontmatter.template],
      { page, context }, // variables a.k.a. view
      { content, ...partials } // partials
    );
  }
  // if there is no template, the content itself is the template
  else {
    html = mustache.render(
      content,
      { page, context }, // variables a.k.a. view
      partials // partials
    );
  }
  // 2. run build script
  // TODO: move away from these? Or give them context to work with (e.g. to avoid having to parse frontmatter from the filesystem)
  const hasScript = !!frontmatter.buildScript;
  if (hasScript) {
    const script = await import(cwd() + frontmatter.buildScript);
    html = await script.buildPage(html, frontmatter, slug);
  }
  // 3. minify and return
  return removeWhitespace(html);
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
 * Returns a slug from a given file path. Should always have a trailing slash.
 * @param {string} path The full filesystem file path
 * @param {string} pagesDir The config pages directory, to strip from slugs
 * @returns {string}
 */
function getSlug(path, pagesDir) {
  // 1. initial path
  // index: /home/user/Developer/website/pages/index.html
  // post: /home/user/Developer/website/pages/posts/my-post.md
  let slug = path;
  // 2. strip full path
  // index: /index.html
  // post: /posts/my-post.md
  slug = path.replace(pagesDir, "");
  const isIndexFile = path.endsWith("/index.html") || path.endsWith("index.md");
  // 3. strip extension
  if (isIndexFile) {
    // index: /
    // post: (n/a)
    slug = slug.replace("/index.html", "/").replace("/index.md", "/");
  } else {
    // index: (n/a)
    // post: /posts/my-post/
    slug = slug.replace(extname(slug), "/");
  }
  return slug;
}

/** @typedef {{ path: string; slug: string; frontmatter: Frontmatter; content: string; }} Page */
/**
 * Loads pages from the filesystem and returns their content and metadata
 * @param {string} pagesDir
 * @returns {Promise<Page[]>}
}
 */
async function loadPages(pagesDir) {
  const paths = await getFiles(pagesDir);
  const pages = /** @type {Page[]} */ ([]);
  await Promise.all(
    paths.map(async (path) => {
      // only process markdown or html pages... or xml
      const extension = extname(path);
      if (
        extension === ".md" ||
        extension === ".html" ||
        extension === ".xml" // for feeds
      ) {
        const file = await readFile(path, "utf-8");
        const { frontmatter, content } = extractFrontmatter(file);
        pages.push({
          path,
          slug: frontmatter.permalink || getSlug(path, pagesDir),
          frontmatter,
          content,
        });
      }
    })
  );
  return pages;
}

/**
 * Build context from a raw array of pages
 * @param {Page[]} pages
 * @param {string[]} collections
 * @param {string} pagesDir
 * @return {{[x: string]: Page[]}} context
 */
function buildContext(pages, collections, pagesDir) {
  // 1. sort pages by descending published_date by default (newest posts first in the array)
  //    if a page is missing a published_date, it is filtered out (pages in collections must have a published_date)
  const sortedPages = pages
    .filter((page) => !!page.frontmatter.published_date)
    .sort(
      (a, b) =>
        new Date(b.frontmatter.published_date).getTime() -
        new Date(a.frontmatter.published_date).getTime()
    );
  // 2. reduce pages into collection arrays under a context object
  const context = sortedPages.reduce((acc, cur) => {
    // attempt to get the collection from the page path
    // note: a collection can't be a descendant of another collection, e.g. `posts` and `posts/recipes` (open an issue if you'd like this implemented!)
    const collection = collections.find((collection) =>
      cur.path.includes(`${pagesDir}/${collection}`) ? collection : null
    );
    if (collection) {
      if (!acc[collection]) {
        acc[collection] = [];
      }
      acc[collection].push(cur);
      return acc;
    }
    // page is not in a collection, we omit it from the acc
    return acc;
  }, {});
  return context;
}

/**
 * @param {Config} config
 * @returns {Promise<void>}
 */
export default async function buildPages({
  outDir,
  pagesDir,
  templatesDir,
  partialsDir,
  collections,
  processContext,
  remarkPlugins,
  rehypePlugins,
}) {
  try {
    // run all filesystem ops in parallel
    const [pages, templates, partials] = await Promise.all([
      loadPages(pagesDir),
      loadTemplates(templatesDir),
      loadPartials(partialsDir),
    ]);
    console.log(`Building ${pages.length} pages.`);

    console.time("Converting Markdown to HTML");
    // parse markdown and convert to HTML
    const htmlPages = await Promise.all(
      pages.map(async (page) => {
        const { path, content } = page;
        let html = content;
        if (path.endsWith(".md")) {
          html = await processMarkdown(content, remarkPlugins, rehypePlugins);
        }
        return { ...page, content: html };
      })
    );
    console.timeEnd("Converting Markdown to HTML");

    // build template context
    const context = buildContext(htmlPages, collections, pagesDir);
    const processedContext = processContext(context);

    console.time("Building pages and writing to outDir");
    await Promise.all(
      htmlPages.map(async (page) => {
        // 1. feed page, context, templates and partials to mustache
        const result = await buildPage({
          page,
          context: processedContext,
          templates,
          partials,
        });
        // 2. write to fs
        if (!page.slug.endsWith("/")) {
          // if there's no trailing slash to the slug, the page shouldn't be saved under `${slug}index.html`
          const parentDir = `${outDir}${dirname(page.slug)}`;
          await mkdir(parentDir, { recursive: true });
          await writeFile(`${outDir}${page.slug}`, result);
        } else {
          const parentDir = `${outDir}${page.slug}`;
          await mkdir(parentDir, { recursive: true });
          await writeFile(`${parentDir}index.html`, result);
        }
      })
    );
    console.timeEnd("Building pages and writing to outDir");
  } catch (error) {
    console.error(error);
  }
}
