/**
 * Merge class names with Tailwind CSS support
 * Simple implementation without external dependencies
 */
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
