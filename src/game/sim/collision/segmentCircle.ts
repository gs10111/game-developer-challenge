export function segmentCircleEntry(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centreX: number,
  centreY: number,
  radius: number,
): number {
  const alongX = endX - startX;
  const alongY = endY - startY;
  const offsetX = startX - centreX;
  const offsetY = startY - centreY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c < 0) {
    return 0;
  }
  const a = alongX * alongX + alongY * alongY;
  if (a === 0) {
    return -1;
  }
  const b = 2 * (offsetX * alongX + offsetY * alongY);
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) {
    return -1;
  }
  const entry = (0 - b - Math.sqrt(discriminant)) / (2 * a);
  if (entry >= 0 && entry < 1) {
    return entry;
  }
  return -1;
}
