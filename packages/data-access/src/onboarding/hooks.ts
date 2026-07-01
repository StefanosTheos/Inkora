import {
  type OnboardingReaction, REACTION_WEIGHTS, type StyleCard,
} from "@inkora/domain";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { InkoraClient } from "../client/types";
import { fetchStyleCards, finishOnboarding, getRecommendedArtists } from "./preferences";

/** Load the questionnaire deck (cached). */
export function useStyleDeck(client: InkoraClient) {
  return useQuery({ queryKey: ["style-deck"], queryFn: () => fetchStyleCards(client) });
}

/** Recommendations for the given top style slugs (enabled once slugs exist). */
export function useRecommendedArtists(client: InkoraClient, styleSlugs: string[], enabled = true) {
  return useQuery({
    queryKey: ["recommendations", styleSlugs],
    queryFn: () => getRecommendedArtists(client, styleSlugs),
    enabled: enabled && styleSlugs.length > 0,
  });
}

/** Save preferences + complete onboarding. */
export function useFinishOnboarding(client: InkoraClient) {
  return useMutation({ mutationFn: (weights: Record<string, number>) => finishOnboarding(client, weights) });
}

/**
 * Platform-agnostic questionnaire state machine (card-at-a-time).
 * Mobile drives it as a swipe/step deck; web can read `reactions`/`weights` directly.
 */
export function useOnboardingController(styles: StyleCard[]) {
  const [index, setIndex] = useState(0);
  const [reactions, setReactions] = useState<Record<string, OnboardingReaction>>({});

  const current = styles[index] ?? null;
  const done = styles.length > 0 && index >= styles.length;
  const progress = styles.length ? Math.min(index, styles.length) / styles.length : 0;

  const react = useCallback(
    (reaction: OnboardingReaction) => {
      if (!current) return;
      setReactions((prev) => ({ ...prev, [current.id]: reaction }));
      setIndex((i) => i + 1);
    },
    [current],
  );

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const reset = useCallback(() => {
    setIndex(0);
    setReactions({});
  }, []);

  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const [id, reaction] of Object.entries(reactions)) w[id] = REACTION_WEIGHTS[reaction];
    return w;
  }, [reactions]);

  return { index, current, done, progress, reactions, weights, react, back, reset, total: styles.length };
}
