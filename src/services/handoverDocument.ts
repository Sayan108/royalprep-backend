export function isPassiveDocumentHtml(html: string) {
  return Boolean(html) && !/<\s*(script|iframe|object|embed|form|base)\b/i.test(html) &&
    !/<\s*meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh/i.test(html);
}

export function validatePassiveDocumentHtml(html: string, label: string) {
  if (!isPassiveDocumentHtml(html))
    throw new Error(`Missing or active HTML in ${label}.`);
}
