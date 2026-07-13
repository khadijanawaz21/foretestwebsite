/**
 * generator/lib/template-engine.mjs
 *
 * Marker-based templating engine, per Static Page Generator Specification
 * §6 (Templating Engine) — a dependency-free convention using HTML
 * comments so template files remain valid, previewable HTML at all times:
 *
 *   Token substitution:  <!--SSG:TITLE--> etc.
 *   Repeat blocks:       <!--SSG:REPEAT:NAME--> ... <!--SSG:/REPEAT-->
 *
 * STATUS (Sprint 1 — foundation): unimplemented. This module is the
 * shared engine every page type (property, area, developer, blog post)
 * will render through — building it correctly requires at least one real
 * template with real markers to test against, which per the phased plan
 * (Static Page Generator Spec Part 15) is Sprint 2's Phase A/B work, not
 * Sprint 1's.
 */
import { NotImplementedError } from './errors.mjs';

/**
 * Replaces every <!--SSG:KEY--> marker in templateHtml with the
 * corresponding value from `data[KEY]`, and expands any
 * <!--SSG:REPEAT:NAME--> ... <!--SSG:/REPEAT--> blocks once per item in
 * `data[NAME]` (an array).
 *
 * @param {string} templateHtml Raw contents of a *.template.html file.
 * @param {Record<string, unknown>} data Marker name → value map.
 * @returns {string} Rendered HTML.
 */
export function renderTemplate(templateHtml, data) {
  throw new NotImplementedError('renderTemplate', 'Sprint 2 (SSG Spec Phase A)');
}

/**
 * Extracts the fragment between a named <!--SSG:REPEAT:NAME--> /
 * <!--SSG:/REPEAT--> pair so it can be rendered once per array item.
 * Exposed separately from renderTemplate() so it's independently testable.
 *
 * @param {string} templateHtml
 * @param {string} blockName
 * @returns {{ before: string, block: string, after: string } | null}
 */
export function extractRepeatBlock(templateHtml, blockName) {
  throw new NotImplementedError('extractRepeatBlock', 'Sprint 2 (SSG Spec Phase A)');
}
