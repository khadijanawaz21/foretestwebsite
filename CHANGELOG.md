# Changelog

All notable changes to the FORE (Fair Opportunity Real Estate) website are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.1] - 2026-07-15

### Highlights
- Repository hygiene
- Removed obsolete tracked JSON data
- Removed duplicate local development copies
- Verified clean build
- Verified full test suite
- No functional changes

## [1.1.0] - 2026-07-15

### Highlights
- PostgreSQL lead platform
- Agents / Leads / Lead Activity schema
- Secure POST /api/leads endpoint
- Validation
- Honeypot protection
- PostgreSQL-backed rate limiting
- HMAC IP hashing
- Transactional email framework (best-effort, Resend-ready)
- Frontend migration from Google Apps Script to /api/leads
- Activity logging
- Production deployment

### Notes
Transactional email is intentionally disabled until the sending domain is verified in Resend.

## [1.0.0] - 2026-07-13

### Highlights
- Static page generator
- Property detail page generation
- SEO platform
- Middleware & redirect engine
- Canonical URL handling
- Structured data generation
- Sitemap generation
- Area pages
- Build pipeline improvements
