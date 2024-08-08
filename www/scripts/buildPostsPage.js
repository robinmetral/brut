import { cwd } from "process";
import { readdir, readFile } from "fs/promises";
import { load } from "js-yaml";

const POSTS_DIR = `${cwd()}/pages/posts`;

/**
 * @typedef {Object.<string, string>} Frontmatter
 */

/**
 * Extracts frontmatter from string using js-yaml
 *
 * @param {string} file
 * @returns {Frontmatter}
 */
function getFrontmatter(file) {
  const match =
    /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/.exec(file);

  if (match) {
    const frontmatter = /** @type {Frontmatter} */ (load(match[1]));
    return frontmatter;
  } else {
    return {};
  }
}

/**
 * @typedef {Object} Post
 * @property {string} title
 * @property {string} date
 * @property {string} slug
 */

/**
 * @returns {Promise<Post[]>}
 */
async function getPosts() {
  const files = await readdir(POSTS_DIR);
  const posts /** @type {Post[]} */ = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(`${POSTS_DIR}/${file}`, "utf-8");
      const frontmatter = getFrontmatter(content);
      return {
        title: frontmatter.title,
        date: new Date(frontmatter.date).toLocaleDateString(),
        slug: `/posts/${file.replace(".md", "")}`,
      };
    })
  );
  return posts;
}

/**
 *
 * @param {string} html
 * @returns {Promise<string>}
 */
export async function buildPage(html) {
  try {
    const posts = await getPosts();
    const postsHtml = posts
      .map(
        (post) =>
          `<li><a href="${post.slug}">${post.date}: ${post.title}</a></li>`
      )
      .join("");
    return html.replace("<li>--POSTS--</li>", postsHtml);
  } catch (error) {
    throw new Error(`Failed to build page: ${error}`);
  }
}
