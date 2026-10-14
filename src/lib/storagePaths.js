export function pathFromPublicUrl(url, bucket) {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}