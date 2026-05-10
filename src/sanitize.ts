import DOMPurify from 'isomorphic-dompurify';

const PICSUM_RE = /^https:\/\/picsum\.photos\//;
const SAFE_HREF_RE = /^(https:\/\/|#)/;

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'src' && !PICSUM_RE.test(data.attrValue)) {
    data.attrValue = '';
  }
  if (data.attrName === 'href' && !SAFE_HREF_RE.test(data.attrValue)) {
    data.attrValue = '#';
  }
});

const ALLOWED_TAGS = [
  'main', 'section', 'div', 'header',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'img', 'button',
  'ul', 'ol', 'li', 'strong', 'em', 'br',
];

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['class', 'id', 'src', 'alt', 'href', 'aria-label', 'aria-hidden', 'role'],
  });
}
