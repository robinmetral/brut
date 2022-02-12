import fs from "fs-extra";
import { cwd } from "process";
import klaw from "klaw";
import { load } from "js-yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import mustache from "mustache";
import { minify as minifier } from "html-minifier-terser";
import type { Config } from ".";

const { writeFile, readFile, ensureDir } = fs;

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
  frontmatter: Frontmatter
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
    content = await script.buildPage(content, frontmatter);
  }
  // 3. minify and return
  return minify(content);
}

export default async function buildPages({
  outDir: outDirRoot,
  pagesDir,
}: Config) {
  try {
    for await (const { path } of klaw(pagesDir)) {
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
        // 3. build page
        const result = await buildPage(html, frontmatter);
        // 4. save result to out dir and handle pretty urls
        let outDir: string = `${outDirRoot}${path.replace(pagesDir, "")}`;
        const isIndexFile =
          path.endsWith("/index.html") || path.endsWith("index.md");
        if (isIndexFile) {
          outDir = outDir.replace("/index.html", "").replace("/index.md", "");
        } else {
          outDir = outDir.replace(".md", "").replace(".html", "");
        }
        await ensureDir(outDir);
        await writeFile(`${outDir}/index.html`, result);
      }
    }
  } catch (error) {
    console.error(error); // TODO error handling with klaw
  }
}
