import fs from "fs-extra";
const { emptyDir, readdir, writeFile } = fs; // fs-extra doesn't support esm

import { readSync } from "to-vfile";
import { h } from "hastscript";
import { unified } from "unified";
import unifiedInferGitMeta from "unified-infer-git-meta";
import rehypeInferTitleMeta from "rehype-infer-title-meta";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeMeta from "rehype-meta";
import rehypeDocument from "rehype-document";
import rehypeRewrite from "rehype-rewrite";
import rehypeStringify from "rehype-stringify";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import { matter } from "vfile-matter";

const POSTS_DIR = "./src/posts/";
const OUT_DIR = "./dist/posts/";

const navHast = h("nav", [
  h("ul", [
    h("li", [h("a", { href: "/" }, "Home")]),
    h("li", [h("a", { href: "/posts" }, "Posts")]),
  ]),
]);

async function buildPost(f: string) {
  const file = readSync(`${POSTS_DIR}${f}`);
  return (
    unified()
      /**
       * `vfile-matter` extracts frontmatter from the file and saves it
       * to `file.data` as custom properties. These properties are later
       * used by `rehype-meta`.
       * https://github.com/vfile/vfile-matter
       */
      .use(() => (_tree, file) => {
        matter(file);
      })
      /**
       * `unified-infer-git-meta` sets `published`, `modified` and `author`
       * to `file.data.meta` for later use via `rehype-meta`.
       * https://github.com/unifiedjs/unified-infer-git-meta
       */
      .use(unifiedInferGitMeta)
      /**
       * `remark-parse` parses the markdown source to mdast.
       * https://github.com/remarkjs/remark/tree/main/packages/remark-parse
       */
      .use(remarkParse)
      /**
       * `remark-frontmatter` ensures frontmatter is not parsed as markdown.
       * We're not actually using the yaml output here because we have the one
       * from `vfile-matter`.
       * https://github.com/remarkjs/remark-frontmatter
       */
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeDocument, {
        css: "/global.css",
        link: [
          {
            rel: "icon",
            href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌿</text></svg>",
          },
          {
            rel: "preload",
            href: "/fonts/FernVariable-Roman-VF.woff2",
            as: "font",
            type: "font/woff2",
            crossorigin: true,
          },
        ],
      })
      .use(rehypeInferTitleMeta)
      .use(rehypeMeta, {
        name: "Robin Métral",
        separator: " / ",
        type: "article",
        og: true,
        twitter: true,
        authorTwitter: "@robinmetral",
      })
      /**
       * Adds support for rewriting parts of the hast. We use this to insert
       * the nav at the beginning of the body element.
       * https://github.com/jaywcjlove/rehype-rewrite
       */
      .use(rehypeRewrite, {
        rewrite: (node) => {
          if (node.type == "element" && node.tagName == "body") {
            node.children = [navHast, ...node.children];
          }
        },
      })
      .use(rehypeMinifyWhitespace)
      .use(rehypeStringify)
      .process(file)
  );
}

export default async function buildPosts() {
  const files = await readdir(POSTS_DIR);
  await emptyDir(OUT_DIR);
  await Promise.all(
    files.map(async function (file) {
      const html = await buildPost(file);
      await writeFile(OUT_DIR + file.replace(".md", ".html"), String(html));
    })
  );
}
