import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string) {
  // Use decodeURIComponent if the text is already encoded (from URL)
  let processed = text;
  try {
    processed = decodeURIComponent(text);
  } catch {
    // Already decoded
  }

  return processed
    .toLowerCase()
    .trim()
    .replace(/[^\u0600-\u06FF\w\s-]/g, '') // Keep Arabic and alphanumeric
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
