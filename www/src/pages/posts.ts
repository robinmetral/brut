import { cwd } from "process";
import { readdir, readFile } from "fs/promises";
import { load } from "js-yaml";

const POSTS_DIR = `${cwd()}/src/posts`;

type Frontmatter = { [key: string]: string };

function getFrontmatter(file: string): Frontmatter {
  const match =
    /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/.exec(file);

  if (match) {
    return load(match[1]) as Frontmatter;
  } else {
    return {};
  }
}

type Post = { title: string; date: string; slug: string };

async function getPosts(): Promise<Post[]> {
  const files = await readdir(POSTS_DIR);
  const posts: Post[] = await Promise.all(
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

export async function buildPage(html: string): Promise<string> {
  try {
    const posts = await getPosts();
    const postsHtml = posts
      .map(
        (post) =>
          `<li><a href="${post.slug}">${post.date}: ${post.title}</a></li>`
      )
      .join("");
    return html.replace(
      '<ul id="posts" />',
      `<ul id="posts">${postsHtml}</ul>`
    );
  } catch (error) {
    throw new Error(`Failed to build page: ${error}`);
  }
}
