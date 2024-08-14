export default {
  pagesDir: "/pages",
  collections: ["posts"],
  processContext: (context) => {
    // process dates
    const posts = context.posts.map((post) => {
      const publishedDate = new Date(post.frontmatter.published_date);
      post.frontmatter.published_date_string =
        publishedDate.toLocaleDateString();
      post.frontmatter.published_date_iso = publishedDate.toISOString(); // ~= RFC-3339 for Atom feed
      return post;
    });
    context.posts = posts;
    // add <updated> date for Atom feed template
    context.updated_date_iso = context.posts[0].frontmatter.published_date_iso;
    return context;
  },
};
