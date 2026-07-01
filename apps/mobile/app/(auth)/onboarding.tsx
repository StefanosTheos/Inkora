// Route: /onboarding — tattoo style questionnaire → preference % → recommendations.
// Reached automatically by the root gate when an authenticated user has no onboarded_at.
import { SafeAreaView } from "react-native";
import { OnboardingFlow } from "../../src/features/onboarding/OnboardingFlow";

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <OnboardingFlow />
    </SafeAreaView>
  );
}
