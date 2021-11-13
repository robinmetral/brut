import { minify as minifier } from "html-minifier-terser";

export async function minify(file: string): Promise<string> {
  return minifier(file, {
    collapseWhitespace: true,
    removeComments: true,
    collapseBooleanAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    minifyJS: true,
  });
}
