import { z } from "zod";
import type { SiteData } from "./site-types";
const text = z.string().max(40000), id = z.string().min(1).max(150), slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URLs must use lowercase letters, numbers and hyphens.");
const url = z.string().max(4000).refine(v => !v || /^https:\/\//.test(v) || /^\/api\/media\//.test(v), "Upload media or use an HTTPS URL.");
export const mediaSchema = z.object({ id, url, type: z.enum(["image", "video"]), alt: text, shown: z.boolean().optional(), seconds: z.number().min(0.1).max(86400).nullable().optional() });
export type Media = z.infer<typeof mediaSchema>;
export const panelSchema = z.object({ id, label: text, type: z.enum(["hero", "collections", "split", "instagram", "text", "contact"]), shown: z.boolean(), title: text, body: text, height: z.number().min(0).max(100).optional(), collectionIds: z.array(id).optional(), reelUrls: z.array(z.string().regex(/^https:\/\/(www\.)?instagram\.com\/(?:reel|p)\/[A-Za-z0-9_-]+\/?$/)).optional(), media: z.array(mediaSchema), linkLabel: text, link: z.string().max(250).refine(v => !v || /^\/(?!\/)[a-z0-9\-/]*$/.test(v)), reelUrl: z.string().max(1000).refine(v => !v || /^https:\/\/(www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+\/?$/.test(v), "Use a full Instagram reel URL.") });
export type Panel = z.infer<typeof panelSchema>;
export const productSchema = z.object({ id, slug, name: z.string().min(1).max(250), description: text, price: z.number().min(0).max(10000000).nullable(), showPrice: z.boolean(), published: z.boolean(), media: z.array(mediaSchema) });
export type Product = z.infer<typeof productSchema> & {
    recommendations?: string[];
};
export const collectionSchema = z.object({ id, slug, name: z.string().min(1).max(250), description: text, published: z.boolean(), showPrices: z.boolean().optional(), showPriceRequest: z.boolean().optional(), heroShown: z.boolean().optional(), heroHeight: z.number().min(0).max(100).optional(), hero: z.array(mediaSchema), cover: z.array(mediaSchema), products: z.array(productSchema) });
export type Collection = Omit<z.infer<typeof collectionSchema>, "products"> & {
    products: Product[];
};
export const pageSchema = z.object({ id, slug, label: z.string().min(1).max(250), published: z.boolean(), panels: z.array(panelSchema) });
export type Page = z.infer<typeof pageSchema>;
export const studioSchema = z.object({ version: z.literal(2), settings: z.object({ brandName: text, logo: mediaSchema.optional(), announcement: text, contactEmail: z.string().email(), contactPhone: text, studioLocation: text, footerNote: text, headerHeight: z.number().min(0).max(100).optional(), footerHeight: z.number().min(0).max(100).optional() }), home: z.array(panelSchema), pages: z.array(pageSchema), collections: z.array(collectionSchema) }).superRefine((v, ctx) => {
    for (const [label, values] of [["Page URLs", v.pages.map(p => p.slug)], ["Collection URLs", v.collections.map(c => c.slug)], ["Product URLs", v.collections.flatMap(c => c.products.map(p => p.slug))]] as const)
        if (new Set(values).size !== values.length)
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be unique.` });
});
export type StudioData = Omit<z.infer<typeof studioSchema>, "collections"> & {
    collections: Collection[];
};
export const footerPages = [["terms-policy", "Terms & Policy"], ["faqs", "FAQs"], ["terms-of-use", "Terms of Use"], ["privacy-policy", "Privacy Policy"], ["return-policy", "Return Policy"]];
export const navPages = [["custom-bridal", "Custom Bridal"], ["about-us", "About Us"], ["retailers", "Retailers"], ["contact-us", "Contact Us"]];
export const newPanel = (type: Panel["type"] = "split", label = "New panel"): Panel => ({ id: crypto.randomUUID(), label, type, shown: true, title: "", body: "", media: [], linkLabel: "", link: "", reelUrl: "" });
export const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function moveTo<T>(items: T[], index: number, position: number) { const next = [...items]; const [item] = next.splice(index, 1); next.splice(Math.max(0, Math.min(next.length, position - 1)), 0, item); return next; }
export function migrate(old: SiteData): StudioData {
    const s = old.settings;
    const media = (url: string, type: Media["type"] = "image"): Media[] => url ? [{ id: crypto.randomUUID(), url, type, alt: "Julie Sufi bridal couture" }] : [];
    const panel = (type: Panel["type"], label: string, title = "", body = "", assets: Media[] = [], link = "", linkLabel = ""): Panel => ({ ...newPanel(type, label), title, body, media: assets, link, linkLabel });
    const normalise = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");
    const chosen = [
        old.collections.find(c => normalise(c.name) === "gardenia"),
        old.collections.find(c => ["moncouer", "moncoeur"].includes(normalise(c.name))),
    ];
    for (let i = 0; i < 2; i++) {
        if (!chosen[i])
            chosen[i] = old.collections.find(c => !chosen.some(p => p?.id === c.id));
        if (!chosen[i])
            chosen[i] = { id: crypto.randomUUID(), slug: i ? "mon-couer" : "gardenia", name: i ? "Mon Couer" : "Gardenia", description: "", imageUrl: s.heroImageUrl, sortOrder: i, published: true };
    }
    const ordered = [...chosen.filter((c): c is NonNullable<typeof c> => !!c), ...old.collections.filter(c => !chosen.some(p => p?.id === c.id))];
    const collections: Collection[] = ordered.map((c, i) => ({ id: c.id, slug: c.slug, name: i === 0 ? "Gardenia" : i === 1 ? "Mon Couer" : c.name, description: c.description, published: i < 2, hero: media(c.imageUrl), cover: media(c.imageUrl), products: old.products.filter(p => p.collectionId === c.id).map(p => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, price: p.price, showPrice: p.price !== null, published: p.status !== "archive", media: [...media(p.imageUrl), ...media(p.secondaryImageUrl)] })) }));
    const orphans = old.products.filter(p => !old.collections.some(c => c.id === p.collectionId));
    if (orphans.length)
        collections.push({ id: "legacy-unassigned", slug: "unassigned", name: "Unassigned", description: "Assign these preserved products before publishing.", published: false, hero: [], cover: [], products: orphans.map(p => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, price: p.price, showPrice: false, published: false, media: [...media(p.imageUrl), ...media(p.secondaryImageUrl)] })) });
    const pages: Page[] = old.pages.map(p => { const sections = old.sections.filter(s => s.pageId === p.id); const first = sections.find(s => s.mediaUrl); return { id: p.id, slug: p.slug, label: p.label, published: p.published, panels: [panel(p.slug === "contact-us" ? "contact" : "split", p.label, p.title, [p.intro, p.body].filter(Boolean).join("\n\n"), first ? media(first.mediaUrl, first.mediaType === "video" ? "video" : "image") : []), ...sections.map(s => ({ ...panel("split", s.heading || "Section", s.heading, s.copy, media(s.mediaUrl, s.mediaType === "video" ? "video" : "image")), shown: p.slug === "about-us" ? false : s.published })), ...(p.slug === "about-us" ? [panel("contact", "Contact box", "Contact us")] : [])] }; });
    if (!pages.some(p => p.slug === "custom-bridal"))
        pages.push({ id: "page-custom", slug: "custom-bridal", label: "Custom Bridal", published: true, panels: [panel("hero", "Hero", "Custom bridal", "", media(s.heroImageUrl)), panel("split", "Our approach", s.storyTitle, s.storyCopy, media(s.storyImageUrl)), panel("contact", "Custom bridal enquiry", "Your custom bridal enquiry")] });
    if (!pages.some(p => p.slug === "retailers"))
        pages.push({ id: "page-retailers", slug: "retailers", label: "Retailers", published: true, panels: [panel("split", "Retailers introduction", "Retailers", "For retailer enquiries, please contact our studio.", media(s.storyImageUrl), "/pages/contact-us", "Contact us")] });
    for (const [slug, label] of footerPages)
        if (!pages.some(p => p.slug === slug))
            pages.push({ id: `page-${slug}`, slug, label, published: true, panels: [panel("text", label, label, "Please contact the studio for further information.", [], "/pages/contact-us", "Contact us")] });
    return { version: 2, settings: { brandName: s.brandName, announcement: s.announcement, contactEmail: s.contactEmail, contactPhone: s.contactPhone, studioLocation: s.studioLocation, footerNote: s.footerNote }, home: [panel("hero", "Home hero", s.heroTitle, s.heroSubtitle, [...media(s.heroImageUrl), ...media(s.heroVideoUrl, "video")]), panel("collections", "Collections", "The collections"), panel("hero", "Custom bridal", s.storyTitle, s.storyCopy, media(s.storyImageUrl), "/pages/custom-bridal", "Explore custom bridal"), panel("instagram", "Instagram reels", "Follow @juliesufi"), panel("text", "Contact", "Begin your story.", "We would love to hear from you.", [], "/pages/contact-us", "Contact us")], pages, collections };
}
export function publicData(data: StudioData): StudioData {
    const result = structuredClone(data);
    result.pages = result.pages.filter(p => p.published);
    result.collections = result.collections.filter(c => c.published);
    for (const c of result.collections)
        c.products = c.products.filter(p => p.published);
    for (const panel of [...result.home, ...result.pages.flatMap(p => p.panels)])
        panel.media = panel.media.filter(m => m.shown !== false);
    for (const c of result.collections) {
        c.hero = c.hero.filter(m => m.shown !== false);
        c.cover = c.cover.filter(m => m.shown !== false);
        for (const p of c.products)
            p.media = p.media.filter(m => m.shown !== false);
    }
    const products = result.collections.flatMap(c => c.products);
    for (const p of products) {
        const candidates = products.filter(q => q.id !== p.id && p.price !== null && q.price !== null && Math.abs(q.price - p.price) <= Math.max(p.price * .25, 1));
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        p.recommendations = candidates.slice(0, 5).map(q => q.id);
    }
    for (const p of products)
        if (!result.collections.find(c => c.products.some(q => q.id === p.id))?.showPrices)
            p.price = null;
    return result;
}
