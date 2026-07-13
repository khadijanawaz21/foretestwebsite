/**
 * generator/lib/schema.mjs
 * JSON-LD structured-data builders (Static Page Generator Spec §7.2,
 * Knowledge Architecture Part 6). Each builder returns a plain object;
 * undefined fields are intentionally left in place — JSON.stringify
 * omits them automatically. Absolute URLs use config.siteUrl.
 */
import { config } from '../config.mjs';
import { SchemaBuildError } from './errors.mjs';
import { propertyPagePath } from './canonical-url.mjs';

const ORGANIZATION_FACTS = {
  name: 'Fair Opportunity Real Estate',
  alternateName: 'FORE',
  telephone: '+971506508799',
  email: 'info@fairopportunityrealestate.com',
  streetAddress: 'Office 3602, 36th Floor, Burj Al Salam Tower, Trade Center',
  addressLocality: 'Dubai',
  addressCountry: 'AE',
  sameAs: [
    'https://www.instagram.com/fairopportunityrealestate/',
    'https://www.facebook.com/fairopportunityrealestate/',
    'https://ae.linkedin.com/company/fair-opportunity-real-estate',
    'https://www.youtube.com/@fairopportunityrealestate',
    'https://www.tiktok.com/@fairopportunity',
  ],
};

function requireSiteUrl() {
  if (!config.siteUrl) {
    throw new SchemaBuildError('SITE_BASE_URL is not configured — cannot build absolute URLs for structured data.');
  }
  return config.siteUrl.replace(/\/+$/, '');
}

function requireFields(entity, fields, context) {
  for (const field of fields) {
    if (entity == null || entity[field] === undefined || entity[field] === null || entity[field] === '') {
      throw new SchemaBuildError(`${context}: missing required field "${field}".`);
    }
  }
}

function toIsoDate(value, context) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new SchemaBuildError(`${context}: invalid date value "${value}".`);
  }
  return date.toISOString();
}

function buildPublisherRef(siteUrl) {
  return {
    '@type': 'Organization',
    name: ORGANIZATION_FACTS.name,
    logo: { '@type': 'ImageObject', url: `${siteUrl}/brand_assets/logo.png` },
  };
}

/**
 * @param {{name: string, slug: string, city?: string}} area
 * @returns {object} Place JSON-LD (Knowledge Architecture Part 6: Area/Community -> Place).
 */
export function buildPlaceSchema(area) {
  requireFields(area, ['name', 'slug'], 'buildPlaceSchema');
  const siteUrl = requireSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: area.name,
    url: `${siteUrl}/areas/${area.slug}/`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: area.name,
      addressRegion: area.city || 'Dubai',
      addressCountry: 'AE',
    },
  };
}

/** @returns {object} Organization + LocalBusiness JSON-LD for FORE itself (homepage). */
export function buildOrganizationSchema() {
  const siteUrl = requireSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    name: ORGANIZATION_FACTS.name,
    alternateName: ORGANIZATION_FACTS.alternateName,
    url: siteUrl,
    logo: `${siteUrl}/brand_assets/logo.png`,
    telephone: ORGANIZATION_FACTS.telephone,
    email: ORGANIZATION_FACTS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ORGANIZATION_FACTS.streetAddress,
      addressLocality: ORGANIZATION_FACTS.addressLocality,
      addressCountry: ORGANIZATION_FACTS.addressCountry,
    },
    sameAs: ORGANIZATION_FACTS.sameAs,
  };
}

/**
 * @param {{name: string, slug: string, areaSlug: string, priceAed: number,
 *   propertyType: string, description?: string, bedrooms?: number,
 *   bathrooms?: number, areaSqft?: number, areaName?: string, city?: string,
 *   currency?: string, offeringType?: 'sale'|'rent', images?: string[]}} listing
 * @returns {object} Residence/Apartment + Offer JSON-LD.
 */
export function buildRealEstateListingSchema(listing) {
  requireFields(listing, ['name', 'slug', 'areaSlug', 'priceAed', 'propertyType'], 'buildRealEstateListingSchema');
  const siteUrl = requireSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': listing.propertyType === 'Apartment' ? 'Apartment' : 'Residence',
    name: listing.name,
    description: listing.description,
    url: `${siteUrl}${propertyPagePath(listing)}`,
    numberOfRooms: listing.bedrooms,
    numberOfBathroomsTotal: listing.bathrooms,
    floorSize: listing.areaSqft
      ? { '@type': 'QuantitativeValue', value: listing.areaSqft, unitCode: 'FTK' }
      : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.areaName,
      addressRegion: listing.city || 'Dubai',
      addressCountry: 'AE',
    },
    image: Array.isArray(listing.images) && listing.images.length ? listing.images : undefined,
    offers: {
      '@type': 'Offer',
      price: listing.priceAed,
      priceCurrency: listing.currency || 'AED',
      availability: 'https://schema.org/InStock',
      businessFunction: listing.offeringType === 'rent' ? 'https://schema.org/LeaseOut' : 'https://schema.org/Sell',
    },
  };
}

/**
 * @param {{title: string, slug: string, publishedDate: string|Date, updatedDate?: string|Date,
 *   excerpt?: string, author?: string, coverImage?: string}} post
 * @returns {object} Article JSON-LD.
 */
export function buildArticleSchema(post) {
  requireFields(post, ['title', 'slug', 'publishedDate'], 'buildArticleSchema');
  const siteUrl = requireSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage ? [post.coverImage] : undefined,
    author: post.author ? { '@type': 'Person', name: post.author } : undefined,
    datePublished: toIsoDate(post.publishedDate, 'buildArticleSchema'),
    dateModified: toIsoDate(post.updatedDate || post.publishedDate, 'buildArticleSchema'),
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteUrl}/blog/${post.slug}/` },
    publisher: buildPublisherRef(siteUrl),
  };
}

/**
 * @param {Array<{name: string, url: string}>} pathSegments Ordered root -> current page.
 * @returns {object} BreadcrumbList JSON-LD.
 */
export function buildBreadcrumbSchema(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    throw new SchemaBuildError('buildBreadcrumbSchema requires a non-empty array of {name, url} segments.');
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: pathSegments.map((segment, index) => {
      if (!segment || !segment.name || !segment.url) {
        throw new SchemaBuildError(`buildBreadcrumbSchema: segment at index ${index} is missing "name" or "url".`);
      }
      return { '@type': 'ListItem', position: index + 1, name: segment.name, item: segment.url };
    }),
  };
}

/**
 * @param {Array<{question: string, answer: string}>} faqItems
 * @returns {object} FAQPage JSON-LD.
 */
export function buildFAQSchema(faqItems) {
  if (!Array.isArray(faqItems) || faqItems.length === 0) {
    throw new SchemaBuildError('buildFAQSchema requires a non-empty array of {question, answer} items.');
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item, index) => {
      if (!item || !item.question || !item.answer) {
        throw new SchemaBuildError(`buildFAQSchema: item at index ${index} is missing "question" or "answer".`);
      }
      return { '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } };
    }),
  };
}

/** Serializes one or more schema objects into a single <script type="application/ld+json"> tag string. */
export function toJsonLdScriptTag(schemaOrSchemas) {
  const payload = Array.isArray(schemaOrSchemas)
    ? { '@context': 'https://schema.org', '@graph': schemaOrSchemas.map(({ '@context': _c, ...rest }) => rest) }
    : schemaOrSchemas;
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}
