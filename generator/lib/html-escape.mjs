/**
 * generator/lib/html-escape.mjs
 * Shared HTML-escaping helper for the Unit Detail Page's new render
 * modules (editorial-copy.mjs, similar-properties.mjs, and the section
 * builders in generate-property-page.mjs). template-engine.mjs keeps its
 * own internal copy — left untouched so this addition carries zero risk
 * to the existing rendering pipeline.
 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
