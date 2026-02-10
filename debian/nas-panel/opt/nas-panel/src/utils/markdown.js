import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function markdownToHtml(markdown) {
  if (!markdown) return ''
  
  // Konwertuj markdown na HTML
  const html = marked.parse(markdown)
  
  // Oczyść HTML dla bezpieczeństwa
  return DOMPurify.sanitize(html)
}