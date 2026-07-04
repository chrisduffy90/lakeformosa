function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Grey silhouette shown until a real headshot is uploaded.
const PLACEHOLDER_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-placeholder-icon"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M3.5 21c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8" fill="currentColor"/></svg>`;

export function avatarMarkup(headshotUrl: string | null | undefined, name: string): string {
  if (headshotUrl) {
    return `<img src="${escapeAttr(headshotUrl)}" alt="${escapeAttr(name)}" />`;
  }
  return PLACEHOLDER_SVG;
}
