export type SiteSettings = {
  brandName: string;
  announcement: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  storyTitle: string;
  storyCopy: string;
  storyImageUrl: string;
  contactEmail: string;
  contactPhone: string;
  studioLocation: string;
  instagramUrl: string;
  footerNote: string;
  homePanels: HomePanel[];
};
export type HomePanel = { id: "hero" | "collections" | "atelier" | "campaign" | "contact"; label: string; enabled: boolean };

export type SitePage = {
  id: string;
  slug: string;
  label: string;
  title: string;
  intro: string;
  body: string;
  sortOrder: number;
  published: boolean;
};

export type SiteSection = {
  id: string;
  pageId: string;
  type: string;
  eyebrow: string;
  heading: string;
  copy: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "none";
  sortOrder: number;
  published: boolean;
};

export type SiteCollection = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  published: boolean;
};

export type SiteProduct = {
  id: string;
  collectionId: string | null;
  name: string;
  slug: string;
  description: string;
  price: number | null;
  priceLabel: string;
  imageUrl: string;
  secondaryImageUrl: string;
  sortOrder: number;
  featured: boolean;
  status: "available" | "archive" | "coming-soon";
};

export type SiteData = {
  settings: SiteSettings;
  pages: SitePage[];
  sections: SiteSection[];
  collections: SiteCollection[];
  products: SiteProduct[];
};
