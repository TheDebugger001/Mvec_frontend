const CATEGORY_ALIASES = {
  phones: ["phones", "smartphones", "mobile", "iphone", "android"],
  electronics: ["electronics", "gadgets", "devices"],
  computers: ["computers", "computing", "laptops", "laptop"],
  fashion: ["fashion", "clothing", "shoes", "bags", "apparel"],
  "home & living": ["home", "furniture", "home & living"],
  beauty: ["beauty", "skincare", "cosmetics"],
  sports: ["sports", "sport", "fitness", "gym"],
  automotive: ["automotive", "auto", "car", "vehicles"],
};

export function normalizeCategory(cat) {
  if (!cat) return "";
  const c = String(cat).trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (c === canonical || aliases.includes(c)) return canonical;
  }
  return c;
}

export function categoryMatches(productCategory, selectedCategory) {
  if (!selectedCategory) return true;
  return normalizeCategory(productCategory) === normalizeCategory(selectedCategory);
}

function scoreProduct(p, query) {
  const s = query.toLowerCase().trim();
  const terms = s.split(/\s+/).filter(Boolean);
  const name = (p.name || "").toLowerCase();
  const brand = (p.brand || "").toLowerCase();
  const sku = (p.sku || "").toLowerCase();
  const vendor = (p.vendor || "").toLowerCase();
  const category = (p.category || "").toLowerCase();
  const description = (p.description || "").toLowerCase();
  const hasAllTerms = (str) => terms.length > 0 && terms.every((t) => str.includes(t));

  if (name === s) return 0;
  if (name.startsWith(s)) return 1;
  if (name.includes(s)) return 2;
  if (hasAllTerms(name)) return 3;
  if (brand === s || brand.includes(s)) return 4;
  if (sku.includes(s)) return 5;
  if (normalizeCategory(category).includes(s) || normalizeCategory(category).split(" ").includes(terms[0])) return 6;
  if (vendor.includes(s)) return 7;
  if (description.includes(s) || hasAllTerms(description)) return 8;
  return Infinity;
}

/**
 * Rank catalog products for a search query + category filter.
 * - Primary results: relevance-ranked matches (exact name first).
 * - Related results: other products in the same categories as the matches
 *   (e.g. searching "iphone" returns iPhones first, then other phones).
 */
export function rankCatalogProducts(products, { q = "", category = "", maxPrice } = {}) {
  const list = Array.isArray(products) ? products : [];
  const categoryFiltered = list.filter((p) => categoryMatches(p.category, category));

  let pool = categoryFiltered;
  if (maxPrice && Number.isFinite(Number(maxPrice))) {
    pool = pool.filter((p) => Number(p.price || 0) <= Number(maxPrice));
  }

  const query = (q || "").trim();
  if (!query) return { results: pool, primary: pool, related: [], primaryCount: pool.length, relatedCount: 0 };

  const scored = pool
    .map((p) => ({ p, score: scoreProduct(p, query) }))
    .filter((x) => x.score !== Infinity)
    .sort((a, b) => a.score - b.score || (Number(b.p.rating) || 0) - (Number(a.p.rating) || 0));

  const primary = scored.map((x) => x.p);
  const categoriesHit = new Set(
    primary
      .map((p) => normalizeCategory(p.category))
      .filter(Boolean)
      .map((c) => c),
  );

  // If the query itself implies a category (e.g. "iphone"/"phone" -> Phones), surface it too
  const s = query.toLowerCase();
  const implied = pool.find((p) => {
    const cat = normalizeCategory(p.category);
    return cat && (cat.includes(s) || cat.split(" ").some((w) => s.includes(w) || w.includes(s)));
  });
  if (implied) categoriesHit.add(normalizeCategory(implied.category));

  const primaryIds = new Set(primary.map((p) => String(p.id)));
  const related = categoriesHit.size
    ? pool.filter((p) => categoriesHit.has(normalizeCategory(p.category)) && !primaryIds.has(String(p.id)))
    : [];

  return { results: [...primary, ...related], primary, related, primaryCount: primary.length, relatedCount: related.length };
}

export function matchesQuery(p, q) {
  return scoreProduct(p, q) !== Infinity;
}

export function aggregateCategories(lists) {
  const seen = new Map();
  (lists || [])
    .flat()
    .filter(Boolean)
    .forEach((c) => {
      const name = typeof c === "string" ? c : c.name;
      if (name && !seen.has(name)) seen.set(name, normalizeCategory(name));
    });
  return [...seen.keys()];
}