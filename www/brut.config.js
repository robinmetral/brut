export default {
  pagesDir: "/pages",
  collections: ["posts"],
  processContext: (context) => {
    // make dates human-readable
    // this could be any other kind of data preprocessing
    // it can also be done in a separate file
    const posts = context.posts.map((post) => {
      post.frontmatter.published_date = new Date(
        post.frontmatter.published_date
      ).toLocaleDateString();
      return post;
    });
    context.posts = posts;
    return context;
  },
};
