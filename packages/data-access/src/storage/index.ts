/**
 * Storage SERVICE interface — shared upload flow against the 7 buckets.
 * Flow: pick (platform) → compress → request signed upload URL (Edge, validates
 * bucket/role/path) → upload → record path on owning row. Private buckets read via
 * short-TTL signed URLs; public via CDN.
 */
export type BucketId =
  | "avatars" | "portfolio" | "ideas"                                  // public-read
  | "chat-attachments" | "journey" | "ai-previews" | "saved-designs";  // private

export interface UploadTicket {
  path: string;
  signedUrl: string;
  expiresIn: number;
}

export interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain";
}

/**
 * Build a public object URL for a `public`-bucket path (e.g. style snapshots).
 * `path` includes the bucket as its first segment, e.g. "styles/fineline.jpg".
 *
 * Pass `transform` to request a resized/re-encoded variant via Supabase's image
 * render endpoint — a big bandwidth win for avatars/thumbnails. Omit it and the
 * URL is byte-for-byte the original object URL (zero behaviour change).
 * NOTE: the render endpoint requires the Supabase Image Transformation add-on;
 * callers gate it behind a flag so unsupported projects keep serving originals.
 */
export function publicStorageUrl(supabaseUrl: string, path: string, transform?: ImageTransform): string {
  const base = supabaseUrl.replace(/\/$/, "");
  if (!transform) return `${base}/storage/v1/object/public/${path}`;
  const q = new URLSearchParams();
  if (transform.width) q.set("width", String(transform.width));
  if (transform.height) q.set("height", String(transform.height));
  if (transform.quality) q.set("quality", String(transform.quality));
  if (transform.resize) q.set("resize", transform.resize);
  const qs = q.toString();
  return `${base}/storage/v1/render/image/public/${path}${qs ? `?${qs}` : ""}`;
}

export interface StorageService {
  createUploadTicket(bucket: BucketId, contentType: string, ext: string): Promise<UploadTicket>; // → Edge Function
  getSignedReadUrl(bucket: BucketId, path: string, ttlSeconds: number): Promise<string>;
  publicUrl(bucket: BucketId, path: string): string;
  transform(path: string, t: ImageTransform): string;
}

// TODO: implement. Platform pickers (expo-image-picker / <input type=file>) live in the apps.
