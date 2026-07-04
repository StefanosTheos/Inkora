// Route: /idea/[id] — tattoo idea detail (image, artist, save, try-on, book, similar).
import { useLocalSearchParams } from "expo-router";

import { IdeaDetailScreen } from "../../src/features/ideas/IdeaDetailScreen";

export default function IdeaDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <IdeaDetailScreen id={id ?? ""} />;
}
