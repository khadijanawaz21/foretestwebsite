# FORE Static Page Generator ("fore-ssg")

Build-time Node script that will generate SEO-optimized static HTML pages
(Property, Area, Developer, Blog Post) from Supabase data, without
adopting a frontend framework. This directory implements the system
described in four governing documents, which are the source of truth for
every decision here:

1. **Repository Audit** — the technical due-diligence findings this whole
   effort responds to.
2. **Master Implementation Roadmap** — this generator is Sprint 4.
3. **Static Page Generator Specification** — the architecture this
   directory's structure and module boundaries implement directly.
4. **FORE Knowledge Architecture** — the entity model (Property, Area,
   Developer, Blog Article, and more) this generator will eventually serve.

Do not redesign the approach described in those documents from inside
this code without first checking back — see the top-level instruction
that established this rule.

## Current status: Sprint 1 — foundation only

**No pages are generated yet.** This sprint exists solely to establish the
folder structure, module boundaries, configuration, logging, and error
handling that later sprints build real logic into — see the Static Page
Generator Specification, Part 15 (Phased Implementation Plan), for what
each future sprint adds.

Every function in `lib/` beyond `logger.mjs`, `errors.mjs`, and
`supabase.mjs`'s `getServiceClient()` currently throws `NotImplementedError`
with a reference to the sprint/phase it belongs to. This is intentional,
not an oversight — see each module's doc comment.

## Directory layout

```
generator/
  build.mjs               Entry point — safe to run today, generates nothing
  config.mjs              Environment-derived settings + the page-type registry
  lib/
    logger.mjs             Leveled logging (implemented)
    errors.mjs              Shared error types (implemented)
    supabase.mjs             Data access — client wiring implemented, queries stubbed
    slugify.mjs               Slug generation — stubbed (Sprint 2)
    template-engine.mjs        Marker-based templating — stubbed (Sprint 2)
    schema.mjs                  JSON-LD builders — stubbed (Sprint 2-4)
    meta.mjs                     Title/description generation — stubbed (Sprint 2)
    sitemap.mjs                   sitemap.xml writer — stubbed (Sprint 2)
    cache-manifest.mjs             Incremental-build hashing — stubbed (Sprint 2+, optimization only)
    validate.mjs                    Content-quality validation — stubbed (Sprint 4)
  templates/
    property.template.html    Placeholder — will derive from property-detail.html (Sprint 2)
    blog-post.template.html    Placeholder — will derive from blog-post.html (Sprint 2-3)
    area.template.html          Placeholder — new, hand-designed template (Sprint 4)
    developer.template.html      Placeholder — new, hand-designed template (Sprint 4)
  .cache/                  Created automatically at build time; gitignored; never commit its contents
```

## Environment variables

See `.env.example` at the repository root. `SUPABASE_URL` and
`SERVICE_KEY` are required for anything beyond Sprint 1's structural
checks; `SITE_BASE_URL` and `GENERATOR_LOG_LEVEL` are optional.

## Running locally

```bash
node generator/build.mjs
```

This is safe to run with no `.env` file at all — it will log a warning
about missing environment variables and otherwise complete normally,
writing nothing except (if missing) creating the empty `generator/.cache/`
directory. See the repository root README/CLAUDE.md for how this fits
into the overall local dev workflow (`serve.mjs`, `screenshot.mjs`).

## What this sprint deliberately does not do

- Does not read or modify `property-detail.html`, `blog-post.html`, or
  any other existing page.
- Does not create `/properties/`, `/areas/`, `/developers/`, or `/blog/`
  output directories.
- Does not create the `areas` or `developers` Supabase tables described
  in the Static Page Generator Specification §3 — that is Sprint 4 work.
- Does not change any current site behavior, routing, or SEO output.
