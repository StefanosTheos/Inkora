import type { ArtistId, StyleId } from "../ids";

/** A user's reaction to a style card during the questionnaire. */
export type OnboardingReaction = "skip" | "like" | "love";

/** Reaction → preference weight. Drives the percentages and recommendations. */
export const REACTION_WEIGHTS: Record<OnboardingReaction, number> = {
  skip: 0,
  like: 1,
  love: 3,
};

/** A style presented in the questionnaire (image snapshot + label). */
export interface StyleCard {
  id: StyleId;
  slug: string;
  name: string;
  imagePath: string | null;
}

/** A computed preference with its share of the user's total signal. */
export interface StylePreference {
  styleId: StyleId;
  slug: string;
  name: string;
  weight: number;
  percentage: number; // 0–100, rounded
}

/** An artist recommended from the user's top styles. */
export interface RecommendedArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  matchCount: number; // how many of the user's top styles this artist covers
  styles: string[];
}
