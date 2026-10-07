import { env } from "cloudflare:workers";
import { getMysqlD1 } from "./mysql-d1";
import type {
  SiteCollection,
  SiteData,
  SitePage,
  SiteProduct,
  SiteSection,
  SiteSettings,
} from "./site-types";

type RuntimeEnv = {
  DB?: D1Database;
  ADMIN_PASSCODE?: string;
};

type SettingsRow = { value_json: string };
type PageRow = Omit<SitePage, "published"> & { published: number };
type SectionRow = Omit<SiteSection, "published" | "mediaType"> & {
  published: number;
  media_type: string;
};
type CollectionRow = Omit<SiteCollection, "published"> & { published: number };
type ProductRow = Omit<SiteProduct, "price" | "featured"> & {
  price: number | null;
  featured: number;
};

const starterSettings: SiteSettings = {
  brandName: "Julie Sufi",
  announcement: "Melbourne bridal couture · private appointments now open",
  heroTitle: "A study in silhouette.",
  heroSubtitle: "Made-to-measure couture for the modern bride.",
  heroImageUrl: "/images/hero-gown.jpg",
  heroVideoUrl: "",
  storyTitle: "The atelier, reimagined.",
  storyCopy:
    "Julie Sufi creates gowns with a quiet sense of drama — considered proportions, tactile fabrics and a finish that feels entirely your own. Every piece begins in Melbourne and is shaped around the woman who will wear it.",
  storyImageUrl: "/images/story-atelier.jpg",
  contactEmail: "appointments@juliesufi.com.au",
  contactPhone: "+61 3 9000 0000",
  studioLocation: "Melbourne, Victoria",
  instagramUrl: "https://instagram.com/juliesufi",
  footerNote: "Bridal couture, designed in Melbourne.",
  homePanels: [
    { id: "hero", label: "Campaign hero", enabled: true },
    { id: "collections", label: "Collections", enabled: true },
    { id: "atelier", label: "The atelier", enabled: true },
    { id: "campaign", label: "Campaign reel", enabled: true },
    { id: "contact", label: "Contact", enabled: true },
  ],
};

const starterPages: SitePage[] = [
  {
    id: "page-about",
    slug: "about-us",
    label: "About us",
    title: "An intimate approach to couture.",
    intro: "A Melbourne studio for gowns that feel personal, precise and unforgettable.",
    body: "From the first sketch to the final hand-finished detail, each Julie Sufi gown is developed in close conversation with the bride. The studio combines old-world technique with a modern eye for proportion, movement and restraint.",
    sortOrder: 0,
    published: true,
  },
  {
    id: "page-story",
    slug: "our-story",
    label: "Our story",
    title: "Made for the moment after the photograph.",
    intro: "The details remain long after the day is over.",
    body: "Julie Sufi was founded on the belief that a wedding gown should carry the bride, not costume her. Each collection explores a new conversation between structure and softness, while the atelier keeps the process deeply considered and personal.",
    sortOrder: 1,
    published: true,
  },
  {
    id: "page-contact",
    slug: "contact-us",
    label: "Contact us",
    title: "Begin your appointment.",
    intro: "Tell us a little about your wedding, your date and the feeling you want to create.",
    body: "Private appointments are held in Melbourne. For trunk shows, interstate enquiries and editorial collaborations, please contact the studio directly.",
    sortOrder: 2,
    published: true,
  },
];

const starterSections: SiteSection[] = [
  {
    id: "section-about-intro",
    pageId: "page-about",
    type: "statement",
    eyebrow: "The house",
    heading: "Couture, with a lighter touch.",
    copy: "A considered process, from first fitting to final veil.",
    mediaUrl: starterSettings.storyImageUrl,
    mediaType: "image",
    sortOrder: 0,
    published: true,
  },
];

const starterCollections: SiteCollection[] = [
  {
    id: "collection-atelier",
    slug: "the-atelier-edit",
    name: "The Atelier Edit",
    description: "Sculptural forms and luminous layers for the ceremony.",
    imageUrl: "/images/collection-atelier-edit.jpg",
    sortOrder: 0,
    published: true,
  },
  {
    id: "collection-after-dark",
    slug: "after-dark",
    name: "After Dark",
    description: "A softer, more fluid language for the second look.",
    imageUrl: "/images/collection-after-dark.jpg",
    sortOrder: 1,
    published: true,
  },
  {
    id: "collection-made-to-measure",
    slug: "made-to-measure",
    name: "Made to Measure",
    description: "Personalised silhouettes, developed around you.",
    imageUrl: "/images/collection-made-to-measure.jpg",
    sortOrder: 2,
    published: true,
  },
];

const starterProducts: SiteProduct[] = [
  {
    id: "product-lucia",
    collectionId: "collection-atelier",
    name: "Lucia",
    slug: "lucia",
    description: "A clean, corseted silhouette softened by a sweeping silk train.",
    price: null,
    priceLabel: "Price on consultation",
    imageUrl: starterCollections[0].imageUrl,
    secondaryImageUrl: starterSettings.heroImageUrl,
    sortOrder: 0,
    featured: true,
    status: "available",
  },
  {
    id: "product-selene",
    collectionId: "collection-after-dark",
    name: "Selene",
    slug: "selene",
    description: "Liquid satin, a low back and the kind of movement that catches candlelight.",
    price: null,
    priceLabel: "Price on consultation",
    imageUrl: starterCollections[1].imageUrl,
    secondaryImageUrl: starterCollections[2].imageUrl,
    sortOrder: 1,
    featured: true,
    status: "available",
  },
  {
    id: "product-elysian",
    collectionId: "collection-made-to-measure",
    name: "Elysian",
    slug: "elysian",
    description: "An architectural gown with hand-placed floral appliqué and a generous train.",
    price: null,
    priceLabel: "Price on consultation",
    imageUrl: starterCollections[2].imageUrl,
    secondaryImageUrl: starterCollections[0].imageUrl,
    sortOrder: 2,
    featured: true,
    status: "available",
  },
];

export const starterData: SiteData = {
  settings: starterSettings,
  pages: starterPages,
  sections: starterSections,
  collections: starterCollections,
  products: starterProducts,
};

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

export function getD1(): D1Database | null {
  return getMysqlD1() ?? runtimeEnv().DB ?? null;
}

function booleanValue(value: number | boolean) {
  return value === true || value === 1;
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function seedIfEmpty(db: D1Database) {
  const existing = await db
    .prepare("SELECT id FROM site_settings WHERE key = ? LIMIT 1")
    .bind("global")
    .first<{ id: number }>();
  if (existing) return;

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT OR IGNORE INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?)",
      )
      .bind("global", JSON.stringify(starterSettings), now),
    ...starterPages.map((page) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO pages (id, slug, label, title, intro, body, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          page.id,
          page.slug,
          page.label,
          page.title,
          page.intro,
          page.body,
          page.sortOrder,
          page.published ? 1 : 0,
          now,
          now,
        ),
    ),
    ...starterSections.map((section) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO sections (id, page_id, type, eyebrow, heading, copy, media_url, media_type, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          section.id,
          section.pageId,
          section.type,
          section.eyebrow,
          section.heading,
          section.copy,
          section.mediaUrl,
          section.mediaType,
          section.sortOrder,
          section.published ? 1 : 0,
          now,
          now,
        ),
    ),
    ...starterCollections.map((collection) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO collections (id, slug, name, description, image_url, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          collection.id,
          collection.slug,
          collection.name,
          collection.description,
          collection.imageUrl,
          collection.sortOrder,
          collection.published ? 1 : 0,
          now,
          now,
        ),
    ),
    ...starterProducts.map((product) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO products (id, collection_id, name, slug, description, price, price_label, image_url, secondary_image_url, sort_order, featured, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          product.id,
          product.collectionId,
          product.name,
          product.slug,
          product.description,
          product.price,
          product.priceLabel,
          product.imageUrl,
          product.secondaryImageUrl,
          product.sortOrder,
          product.featured ? 1 : 0,
          product.status,
          now,
          now,
        ),
    ),
  ];
  await db.batch(statements);
}

export async function readSiteData(db = getD1(), strict = false): Promise<SiteData> {
  if (!db) return starterData;
  try {
    await seedIfEmpty(db);
    const [settingsResult, pagesResult, sectionsResult, collectionsResult, productsResult] =
      await Promise.all([
        db.prepare("SELECT value_json FROM site_settings WHERE key = ? LIMIT 1").bind("global").all<SettingsRow>(),
        db.prepare("SELECT id, slug, label, title, intro, body, sort_order as sortOrder, published FROM pages ORDER BY sort_order ASC, id ASC").all<PageRow>(),
        db.prepare("SELECT id, page_id as pageId, type, eyebrow, heading, copy, media_url as mediaUrl, media_type, sort_order as sortOrder, published FROM sections ORDER BY page_id ASC, sort_order ASC, id ASC").all<SectionRow>(),
        db.prepare("SELECT id, slug, name, description, image_url as imageUrl, sort_order as sortOrder, published FROM collections ORDER BY sort_order ASC, id ASC").all<CollectionRow>(),
        db.prepare("SELECT id, collection_id as collectionId, name, slug, description, price, price_label as priceLabel, image_url as imageUrl, secondary_image_url as secondaryImageUrl, sort_order as sortOrder, featured, status FROM products ORDER BY sort_order ASC, id ASC").all<ProductRow>(),
      ]);

    const storedSettings = settingsResult.results[0] ? safeJson<Partial<SiteSettings>>(settingsResult.results[0].value_json, starterSettings) : {};
    const settings = { ...starterSettings, ...storedSettings, homePanels: storedSettings.homePanels?.length ? storedSettings.homePanels : starterSettings.homePanels };

    return {
      settings,
      pages: pagesResult.results.map((page) => ({ ...page, published: booleanValue(page.published) })),
      sections: sectionsResult.results.map((section) => ({
        ...section,
        mediaType: section.media_type as SiteSection["mediaType"],
        published: booleanValue(section.published),
      })),
      collections: collectionsResult.results.map((collection) => ({ ...collection, published: booleanValue(collection.published) })),
      products: productsResult.results.map((product) => ({ ...product, featured: booleanValue(product.featured) })),
    };
  } catch (error) {
    if (strict) throw error;
    console.error("Unable to read site data", error);
    return starterData;
  }
}

type Mutation = {
  entity: "settings" | "pages" | "sections" | "collections" | "products";
  action: "upsert" | "delete" | "reorder";
  item?: Record<string, unknown>;
  ids?: string[];
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function intValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function idValue(item: Record<string, unknown>) {
  return textValue(item.id) || crypto.randomUUID();
}

function slugValue(item: Record<string, unknown>, fallback: string) {
  const raw = textValue(item.slug, fallback);
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

export async function applyMutation(db: D1Database, mutation: Mutation) {
  await seedIfEmpty(db);
  const item = mutation.item ?? {};
  const now = new Date().toISOString();

  if (mutation.action === "reorder") {
    if (!mutation.ids?.length) return;
    const table =
      mutation.entity === "pages" ||
      mutation.entity === "collections" ||
      mutation.entity === "sections" ||
      mutation.entity === "products"
        ? mutation.entity
        : null;
    if (!table) return;
    await db.batch(
      mutation.ids.map((id, index) =>
        db
          .prepare(`UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ?`)
          .bind(index, now, id),
      ),
    );
    return;
  }

  if (mutation.action === "delete") {
    const id = textValue(item.id);
    if (!id) return;
    const table =
      mutation.entity === "pages" ||
      mutation.entity === "sections" ||
      mutation.entity === "collections" ||
      mutation.entity === "products"
        ? mutation.entity
        : null;
    if (table) await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return;
  }

  if (mutation.entity === "settings") {
    const next = { ...starterSettings, ...item } as SiteSettings;
    await db
      .prepare("INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at")
      .bind("global", JSON.stringify(next), now)
      .run();
    return;
  }

  if (mutation.entity === "pages") {
    const id = idValue(item);
    const slug = slugValue(item, `page-${id.slice(0, 8)}`);
    await db
      .prepare("INSERT INTO pages (id, slug, label, title, intro, body, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, label = excluded.label, title = excluded.title, intro = excluded.intro, body = excluded.body, sort_order = excluded.sort_order, published = excluded.published, updated_at = excluded.updated_at")
      .bind(id, slug, textValue(item.label, "New page"), textValue(item.title, "New page"), textValue(item.intro), textValue(item.body), intValue(item.sortOrder), item.published === false ? 0 : 1, now, now)
      .run();
    return;
  }

  if (mutation.entity === "sections") {
    const id = idValue(item);
    await db
      .prepare("INSERT INTO sections (id, page_id, type, eyebrow, heading, copy, media_url, media_type, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET page_id = excluded.page_id, type = excluded.type, eyebrow = excluded.eyebrow, heading = excluded.heading, copy = excluded.copy, media_url = excluded.media_url, media_type = excluded.media_type, sort_order = excluded.sort_order, published = excluded.published, updated_at = excluded.updated_at")
      .bind(id, textValue(item.pageId), textValue(item.type, "editorial"), textValue(item.eyebrow), textValue(item.heading), textValue(item.copy), textValue(item.mediaUrl), textValue(item.mediaType, "image"), intValue(item.sortOrder), item.published === false ? 0 : 1, now, now)
      .run();
    return;
  }

  if (mutation.entity === "collections") {
    const id = idValue(item);
    const slug = slugValue(item, `collection-${id.slice(0, 8)}`);
    await db
      .prepare("INSERT INTO collections (id, slug, name, description, image_url, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, image_url = excluded.image_url, sort_order = excluded.sort_order, published = excluded.published, updated_at = excluded.updated_at")
      .bind(id, slug, textValue(item.name, "New collection"), textValue(item.description), textValue(item.imageUrl), intValue(item.sortOrder), item.published === false ? 0 : 1, now, now)
      .run();
    return;
  }

  if (mutation.entity === "products") {
    const id = idValue(item);
    const slug = slugValue(item, `product-${id.slice(0, 8)}`);
    const price =
      item.price === null || item.price === "" || item.price === undefined
        ? null
        : intValue(item.price);
    await db
      .prepare("INSERT INTO products (id, collection_id, name, slug, description, price, price_label, image_url, secondary_image_url, sort_order, featured, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET collection_id = excluded.collection_id, name = excluded.name, slug = excluded.slug, description = excluded.description, price = excluded.price, price_label = excluded.price_label, image_url = excluded.image_url, secondary_image_url = excluded.secondary_image_url, sort_order = excluded.sort_order, featured = excluded.featured, status = excluded.status, updated_at = excluded.updated_at")
      .bind(id, textValue(item.collectionId) || null, textValue(item.name, "New gown"), slug, textValue(item.description), price, textValue(item.priceLabel, "Price on consultation"), textValue(item.imageUrl), textValue(item.secondaryImageUrl), intValue(item.sortOrder), item.featured ? 1 : 0, textValue(item.status, "available"), now, now)
      .run();
  }
}
