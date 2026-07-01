// Route: /chats/[conversationId] — realtime chat thread.
import { useLocalSearchParams } from "expo-router";
import { ChatThreadScreen } from "../../../src/features/messaging/ChatThreadScreen";

export default function ConversationRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  return <ChatThreadScreen conversationId={conversationId ?? ""} />;
}
