import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

/** Download a (signed) remote image to a local cache file for share/save. */
async function toLocalFile(url: string): Promise<string> {
  const target = `${FileSystem.cacheDirectory}inkora-tryon-${Date.now()}.png`;
  const res = await FileSystem.downloadAsync(url, target);
  return res.uri;
}

/** Open the OS share sheet with the try-on image. */
export async function shareTryOn(url: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
  const uri = await toLocalFile(url);
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your tattoo try-on" });
}

/** Save the try-on image to the device's photo library (requests add-only permission). */
export async function saveTryOnToPhotos(url: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true); // write-only access
  if (!perm.granted) throw new Error("Allow photo access to save the mockup.");
  const uri = await toLocalFile(url);
  await MediaLibrary.saveToLibraryAsync(uri);
}
