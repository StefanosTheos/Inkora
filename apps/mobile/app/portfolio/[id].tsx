// Route: /portfolio/[id] — portfolio piece detail (same UX as an Explore idea:
// image, artist, save, try-on, book, more from this artist).
import { useLocalSearchParams } from "expo-router";

import { PortfolioDesignScreen } from "../../src/features/portfolio/PortfolioDesignScreen";

export default function PortfolioDesignRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PortfolioDesignScreen id={id ?? ""} />;
}
