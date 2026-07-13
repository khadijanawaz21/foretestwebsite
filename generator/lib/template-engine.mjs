/**
 * generator/lib/template-engine.mjs
 * Marker-based templating (Static Page Generator Spec §6):
 *   - Token substitution:  <!--SSG:KEY-->
 *   - Repeat blocks:       <!--SSG:REPEAT:NAME--> ... <!--SSG:/REPEAT-->
 *     (items reference fields via <!--SSG:ITEM.field-->)
 * Values are HTML-escaped by default; wrap with raw() to insert verbatim HTML.
 */
import { TemplateRenderError } from './errors.mjs';

const TOKEN_REGEX = /<!--SSG:([A-Za-z0-9_.]+)-->/g;
const ITEM_FIELD_REGEX = /<!--SSG:ITEM\.([A-Za-z0-9_]+)-->/g;
const REPEAT_OPEN_REGEX = /<!--SSG:REPEAT:([A-Za-z0-9_]+)-->/g;

/** Marks a value as pre-rendered HTML (not escaped on insertion). */
export function raw(value) {
  return { __ssgRaw: true, value: value == null ? '' : String(value) };
}

function isRaw(value) {
  return !!value && typeof value === 'object' && value.__ssgRaw === true;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toOutputString(value) {
  if (value === undefined || value === null) return '';
  return isRaw(value) ? value.value : escapeHtml(value);
}

/**
 * Extracts the first occurrence of a named repeat block.
 * @returns {{before: string, block: string, after: string} | null} null if absent.
 * @throws {TemplateRenderError} If the opening marker has no matching close.
 */
export function extractRepeatBlock(templateHtml, blockName) {
  const openTag = `<!--SSG:REPEAT:${blockName}-->`;
  const closeTag = '<!--SSG:/REPEAT-->';
  const openIndex = templateHtml.indexOf(openTag);
  if (openIndex === -1) return null;

  const blockStart = openIndex + openTag.length;
  const closeIndex = templateHtml.indexOf(closeTag, blockStart);
  if (closeIndex === -1) {
    throw new TemplateRenderError(
      `Unterminated repeat block "${blockName}" — missing <!--SSG:/REPEAT--> after <!--SSG:REPEAT:${blockName}-->.`
    );
  }

  return {
    before: templateHtml.slice(0, openIndex),
    block: templateHtml.slice(blockStart, closeIndex),
    after: templateHtml.slice(closeIndex + closeTag.length),
  };
}

function renderItemBlock(blockTemplate, item) {
  return blockTemplate.replace(ITEM_FIELD_REGEX, (_m, field) => toOutputString(item ? item[field] : undefined));
}

function expandRepeatBlocks(templateHtml, data) {
  const blockNames = [...templateHtml.matchAll(REPEAT_OPEN_REGEX)].map((m) => m[1]);
  let result = templateHtml;

  for (const name of blockNames) {
    const extracted = extractRepeatBlock(result, name);
    if (!extracted) continue;

    if (!Object.prototype.hasOwnProperty.call(data, name)) {
      throw new TemplateRenderError(`Repeat block "${name}" has no matching key in the provided data.`);
    }
    const items = data[name];
    if (!Array.isArray(items)) {
      throw new TemplateRenderError(`Repeat block "${name}" expected an array, got ${typeof items}.`);
    }

    const rendered = items.map((item) => renderItemBlock(extracted.block, item)).join('');
    result = extracted.before + rendered + extracted.after;
  }

  return result;
}

function substituteTokens(html, data) {
  return html.replace(TOKEN_REGEX, (_m, key) => {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      throw new TemplateRenderError(`No value provided for marker "<!--SSG:${key}-->".`);
    }
    return toOutputString(data[key]);
  });
}

/**
 * Renders a template: expands repeat blocks, then substitutes standalone tokens.
 * @param {string} templateHtml
 * @param {Record<string, unknown>} data Marker name -> value; arrays map to repeat block names.
 * @returns {string}
 */
export function renderTemplate(templateHtml, data) {
  if (typeof templateHtml !== 'string') {
    throw new TemplateRenderError('renderTemplate: "templateHtml" must be a string.');
  }
  if (!data || typeof data !== 'object') {
    throw new TemplateRenderError('renderTemplate: "data" must be an object.');
  }

  return substituteTokens(expandRepeatBlocks(templateHtml, data), data);
}
