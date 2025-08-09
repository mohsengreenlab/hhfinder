import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Configure DOMPurify for job descriptions
purify.setConfig({
  ALLOWED_TAGS: [
    'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'blockquote'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^https?:\/\/|^mailto:/i,
  ADD_ATTR: ['target'],
  FORBID_CONTENTS: ['script', 'style', 'iframe', 'object', 'embed']
});

export function sanitizeHTML(html: string): string {
  if (!html) return '';
  
  const startTime = Date.now();
  
  try {
    // Clean the HTML
    const clean = purify.sanitize(html);
    
    // Add target="_blank" to external links
    const processed = clean.replace(
      /<a\s+href="https?:\/\/[^"]*"[^>]*>/gi, 
      match => match.includes('target=') ? match : match.replace('>', ' target="_blank" rel="noopener noreferrer">')
    );
    
    const duration = Date.now() - startTime;
    console.log(`Sanitized HTML in ${duration}ms`);
    
    return processed;
  } catch (error) {
    console.error('HTML sanitization failed:', error);
    return '';
  }
}

export function stripHTMLToText(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
