/**
 * Compresses a photo on the phone before it's saved (ADR-15, NFR Performance): scaled so
 * its longest side is at most 1600 pixels and re-saved as JPEG at 80% quality, using the
 * browser's own canvas. PDFs, and photos that don't get smaller, are returned unchanged.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<{ blob: Blob; name: string }> {
  if (!file.type.startsWith('image/')) {
    return { blob: file, name: file.name };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!compressed || compressed.size >= file.size) {
    return { blob: file, name: file.name };
  }
  return { blob: compressed, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
}
