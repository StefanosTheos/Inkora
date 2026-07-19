import { sendMessage, uploadChatFile } from "@inkora/data-access";

import { imageUrl } from "./images";
import { supabase } from "./supabase";

/**
 * Copy a design's (public) image into a conversation's chat-attachments bucket
 * and return the stored path — ready to send as an image message. Shared by the
 * chat composer's "saved designs" picker and the "Send to artist" action on
 * design detail screens.
 */
export async function uploadDesignAsChatAttachment(conversationId: string, imagePath: string): Promise<string> {
  const url = imageUrl(imagePath);
  if (!url) throw new Error("This design's image is unavailable.");
  const buf = await (await fetch(url)).arrayBuffer();
  const png = imagePath.toLowerCase().endsWith(".png");
  return uploadChatFile(supabase, conversationId, buf, png ? "image/png" : "image/jpeg", png ? "png" : "jpg");
}

/** Upload a design image into the conversation and post it as an image message
 *  (for callers that aren't inside the live chat, e.g. design detail screens). */
export async function sendDesignToConversation(conversationId: string, senderId: string, imagePath: string): Promise<void> {
  const path = await uploadDesignAsChatAttachment(conversationId, imagePath);
  await sendMessage(supabase, conversationId, senderId, { type: "image", body: "📷 Photo", attachments: [{ path }] });
}
