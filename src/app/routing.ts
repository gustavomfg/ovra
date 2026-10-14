// Hash routing keeps GitHub Pages working without rewrite rules: #/entity-002.
export function slugFromHash(hash: string) {
  return hash.replace(/^#\/?/, "").trim();
}

export function hashForSlug(slug: string) {
  return `#/${slug}`;
}
