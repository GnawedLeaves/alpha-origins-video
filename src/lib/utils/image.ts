// Client-only. Phone photos are often 4-12 MB; shrink them before upload so it's quick on a slow
// connection and stays well inside fal.ai's image limits. Browsers apply the photo's EXIF
// rotation when decoding, so the result is the right way up.
const MAX_SIDE = 1920;

export async function shrinkImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file isn't a photo this browser can open. Try a JPG or PNG.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 3 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the photo. Please try again.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo."))),
      "image/jpeg",
      0.88
    )
  );
}
