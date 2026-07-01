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
 */
export function publicStorageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${path}`;
}

export interface StorageService {
  createUploadTicket(bucket: BucketId, contentType: string, ext: string): Promise<UploadTicket>; // → Edge Function
  getSignedReadUrl(bucket: BucketId, path: string, ttlSeconds: number): Promise<string>;
  publicUrl(bucket: BucketId, path: string): string;
  transform(path: string, t: ImageTransform): string;
}

// TODO: implement. Platform pickers (expo-image-picker / <input type=file>) live in the apps.
