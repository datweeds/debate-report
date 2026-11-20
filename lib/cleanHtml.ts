// Topic bodies are HTML written by Sys Admin. Keep formatting, drop anything
// that runs code or pulls in other pages.
export function cleanHtml(html: string): string {
  return (html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|form|textarea|select|template|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|frame|frameset|template|svg|math)\b[^>]*>/gi, '')
    .replace(/\s(on\w+|srcdoc|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href|action)\s*=\s*(["']?)\s*(javascript|vbscript|data):[^"'\s>]*\2/gi, ' $1="#"');
}
