import type { FavoriteTarget, ModerationStatus } from "../enums";
import type {
  ArtistId, BoardId, IdeaId, PortfolioImageId, ProfileId, SavedDesignId, StyleId,
} from "../ids";

export interface TattooStyle {
  id: StyleId;
  slug: string;
  name: string;
  description: string | null;
  imagePath: string | null;
}

/** Inspiration feed item ("pin"). */
export interface IdeaCard {
  id: IdeaId;
  title: string | null;
  imagePath: string;
  width: number | null;
  height: number | null;
  styleSlugs: string[];
  saveCount: number;            // denormalized cache
  sourceArtistId: ArtistId | null;
  isSaved?: boolean;            // resolved per-viewer
}

/** Full idea view for the idea detail page. */
export interface IdeaDetail {
  id: IdeaId;
  title: string | null;
  description: string | null;
  imagePath: string;
  width: number | null;
  height: number | null;
  styleSlugs: string[];
  saveCount: number;
  artist: {
    id: ArtistId;
    displayName: string;
    avatarPath: string | null;
    headline: string | null;
    isAccepting: boolean;
  } | null;
}

export interface PortfolioImage {
  id: PortfolioImageId;
  artistId: ArtistId;
  imagePath: string;
  caption: string | null;
  placement: string | null;
  moderationStatus: ModerationStatus;
}

export interface Board {
  id: BoardId;
  profileId: ProfileId;
  name: string;
  isPrivate: boolean;
  coverPath: string | null;
}

export interface Favorite {
  profileId: ProfileId;
  targetType: FavoriteTarget;
  targetId: string;
  boardId: BoardId | null;
}

/** Output of Create Idea / AI preview (saved concept). */
export interface SavedDesign {
  id: SavedDesignId;
  profileId: ProfileId;
  title: string | null;
  imagePath: string;
  placement: string | null;
  notes: string | null;
}
