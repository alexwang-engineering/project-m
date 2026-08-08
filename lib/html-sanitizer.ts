import DOMPurify, { type Config } from 'isomorphic-dompurify';

const OPTIONS: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'blockquote',
    'pre',
    'code',
    'h1',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'a',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'hr',
    'span',
    'sub',
    'sup',
  ],
  ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan', 'scope'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'srcset', 'formaction', 'target'],
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
};

/** Sanitises an HTML fragment at both browser and server trust boundaries. */
export function sanitizeEditorHtml(html: string): string {
  if (typeof html !== 'string')
    throw new TypeError('Editor HTML must be a string.');
  return DOMPurify.sanitize(html, OPTIONS);
}
