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
import type { Config } from ".";

const { writeFile, readFile, readdir, ensureDir } = fs;

type Frontmatter = { [key: string]: string };

/**
 * Extracts frontmatter with `---` or `<!-- -->` delimiters from a string.
 * Inspired by vfile-matter: https://github.com/vfile/vfile-matter/
 */
function extractFrontmatter(file: string): {
  frontmatter: Frontmatter;
  content: string;
} {
  const match =
    /^(?:---|<!--)(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?(?:---|-->)(?:\r?\n|\r|$)/.exec(
      file
    );
  if (match) {
    const frontmatter = load(match[1]) as Frontmatter;
    const content = file.slice(match[0].length);
    return { frontmatter, content };
  } else {
    return { frontmatter: {}, content: file };
  }
}

/**
 * Parse the file into an AST, transform with unified plugins,
 * and convert back into html.
 */
function processMarkdown(file: string): Promise<string> {
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
 */
async function minify(html: string): Promise<string> {
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
 */
async function buildPage(
  content: string,
  frontmatter: Frontmatter,
  path: string
): Promise<string> {
  // 1. inject into the template
  const hasTemplate = !!frontmatter.template;
  if (hasTemplate) {
    const template = await readFile(cwd() + frontmatter.template, "utf-8");
    content = mustache.render(
      template,
      frontmatter, // variables
      { content } // partials
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

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return files.flat();
}

export default async function buildPages({
  outDir: outDirRoot,
  pagesDir,
}: Config) {
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
          let html: string = content;
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
          const result = await buildPage(html, frontmatter, relPath);
          await ensureDir(outDir);
          await writeFile(`${outDir}/index.html`, result);
        }
      })
    );
  } catch (error) {
    console.error(error);
  }
}
