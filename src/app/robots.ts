import type { MetadataRoute } from "next";

/**
 * Nothing here is for strangers. Every route past the landing page needs a
 * session, and a household's dinner history has no business in a search index.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
