async function getRepo() {
  try {
    const res = await fetch(`https://api.github.com/repos/robinmetral/brut`);
    const data = await res.json();
    return { stars: data.stargazers_count, updated: data.pushed_at };
  } catch (error) {
    throw new Error(`Couldn't fetch repo information from GitHub: ${error}`);
  }
}

export async function buildPage(html) {
  const data = await getRepo();
  return html
    .replace("--STARS--", data.stars)
    .replace("--UPDATED--", data.updated);
}
