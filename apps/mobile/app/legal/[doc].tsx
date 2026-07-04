// Route: /legal/help | /legal/terms | /legal/privacy — in-app support & legal docs.
import { useLocalSearchParams } from "expo-router";

import { type LegalDoc, LegalScreen } from "../../src/features/legal/LegalScreen";

export default function LegalRoute() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const valid: LegalDoc = doc === "terms" || doc === "privacy" ? doc : "help";
  return <LegalScreen doc={valid} />;
}
