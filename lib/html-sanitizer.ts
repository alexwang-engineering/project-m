import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
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
  allowedAttributes: {
    a: ['href', 'title'],
    span: ['style'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
  },
  allowedStyles: {
    span: {
      'font-size': [/^(8|9|10|11|12|14|16|18|24|36|48)pt$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
};

/** Sanitises an HTML fragment at both browser and server trust boundaries. */
export function sanitizeEditorHtml(html: string): string {
  if (typeof html !== 'string')
    throw new TypeError('Editor HTML must be a string.');
  return sanitizeHtml(html, OPTIONS);
}
