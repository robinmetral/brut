import fs from "fs-extra";
import { cwd } from "process";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import mustache from "mustache";
import { load } from "js-yaml";
import { minify } from "./utils";

const { ensureDir, pathExists, readdir, readFile, writeFile } = fs;

const POSTS_DIR = `${cwd()}/src/posts`;
const OUT_DIR = `${cwd()}/dist/posts`;

type Frontmatter = { [key: string]: string };

/**
 * Extracts frontmatter from a string.
 * Inspired by vfile-matter: https://github.com/vfile/vfile-matter/
 */
function extractFrontmatter(file: string): {
  frontmatter: Frontmatter;
  rest: string;
} {
  const match =
    /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/.exec(file);

  if (match) {
    const frontmatter = load(match[1]) as Frontmatter;
    const rest = file.slice(match[0].length);
    return { frontmatter, rest };
  } else {
    return { frontmatter: {}, rest: file };
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
      .use(remarkRehype)
      /**
       * `rehype-stringify` transforms the hast into HTML.
       * https://github.com/rehypejs/rehype/tree/main/packages/rehype-stringify
       */
      .use(rehypeStringify)
      .process(file)
      .then((vfile) => String(vfile))
  );
}

/**
 * Inject html and frontmatter into a mustache template.
 */
function buildDocument(
  template: string,
  frontmatter: Frontmatter,
  content: string
): string {
  return mustache.render(
    template,
    { ...frontmatter }, // variables
    { content } // partials
  );
}

export default async function buildPosts() {
  const hasPosts = await pathExists(POSTS_DIR);
  if (!hasPosts) {
    return;
  }
  try {
    const files = await readdir(POSTS_DIR);
    const template = await readFile(
      `${cwd()}/src/templates/default.html`,
      "utf-8"
    );
    await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async function (fileName) {
          const file = await readFile(`${POSTS_DIR}/${fileName}`, "utf-8");
          const { frontmatter, rest } = extractFrontmatter(file);
          const content = await processMarkdown(rest);
          const document = buildDocument(template, frontmatter, content);
          const minifiedDocument = await minify(document);
          const outDir = `${OUT_DIR}/${fileName.replace(".md", "/")}`;
          await ensureDir(outDir);
          await writeFile(`${outDir}/index.html`, minifiedDocument); // pretty URLs
        })
    );
  } catch (error) {
    console.error(error);
  }
}
