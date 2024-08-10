export default {
  pagesDir: "/pages",
  processContext: (context) => {
    const posts = [];
    const newPages = context.pages.map((page) => {
      // make dates human-readable
      if (page.frontmatter.date) {
        page.frontmatter.date = new Date(
          page.frontmatter.date
        ).toLocaleDateString();
      }
      // put all posts in a list to loop through using mustache sections
      if (page.path.includes("/posts/")) {
        posts.push(page);
      }
      return page;
    });
    context.pages = newPages;
    context.posts = posts;
    return context;
  },
};
