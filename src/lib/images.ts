/** Compress a photo client-side before upload: fit within 1600px, JPEG q0.82.
 * Also strips EXIF (canvas re-encode drops metadata, including GPS). */
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", 0.82)
  );
  return blob ?? file;
}

export async function uploadPhoto(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  folder: string,
  file: File
): Promise<string> {
  const blob = await compressPhoto(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("barrier-photos")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw error;
  return supabase.storage.from("barrier-photos").getPublicUrl(path).data.publicUrl;
}

export const uploadSubmissionPhoto = (
  supabase: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
  file: File
) => uploadPhoto(supabase, `submissions/${submissionId}`, file);
