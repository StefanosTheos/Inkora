// Route: /create/[id] — AI preview result (placeholder pending state).
import { useLocalSearchParams } from "expo-router";

import { AiPreviewResultScreen } from "../../../src/features/ai/AiPreviewResultScreen";

export default function PreviewResultRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AiPreviewResultScreen id={id ?? ""} />;
}
