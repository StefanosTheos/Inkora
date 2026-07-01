// Route: /messages/[conversationId] — realtime chat thread (web, secondary).
import { ChatView } from "../../../../features/messaging/ChatView";

export default function ConversationPage({ params }: { params: { conversationId: string } }) {
  return <ChatView conversationId={params.conversationId} />;
}
