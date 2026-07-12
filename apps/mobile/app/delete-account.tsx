// Route: /delete-account — deletion, reached only from the Help center so it's
// intentionally deep. Root-level so navigating from /legal/help is a clean,
// same-navigator push (predictable back).
import { DeleteAccountScreen } from "../src/features/dashboard/DeleteAccountScreen";

export default function DeleteAccountRoute() {
  return <DeleteAccountScreen />;
}
