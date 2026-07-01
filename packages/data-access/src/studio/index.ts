import type { ArtistId, StudioId, StudioProfile } from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

interface StudioRow {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  logo_path: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  opening_hours: Record<string, string[][]> | null;
  studio_memberships:
    | { status: string; artists: { id: string; headline: string | null; rating_avg: number; profiles: { display_name: string; avatar_path: string | null } | null } | null }[]
    | null;
}

export async function getStudioProfile(client: InkoraClient, slug: string): Promise<StudioProfile | null> {
  const { data, error } = await client
    .from("studios")
    .select(
      "id, name, slug, bio, logo_path, address_line, city, country, latitude, longitude, opening_hours, studio_memberships(status, artists(id, headline, rating_avg, profiles(display_name, avatar_path)))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  const r = data as unknown as StudioRow;
  return {
    id: r.id as StudioId,
    name: r.name,
    slug: r.slug,
    bio: r.bio,
    logoPath: r.logo_path,
    addressLine: r.address_line,
    city: r.city,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    openingHours: r.opening_hours ?? {},
    roster: (r.studio_memberships ?? [])
      .filter((m) => m.status === "active" && m.artists)
      .map((m) => ({
        id: m.artists!.id as ArtistId,
        displayName: m.artists!.profiles?.display_name ?? "Artist",
        avatarPath: m.artists!.profiles?.avatar_path ?? null,
        headline: m.artists!.headline,
        ratingAvg: Number(m.artists!.rating_avg),
      })),
  };
}

export function useStudioProfile(client: InkoraClient, slug: string) {
  return useQuery({ queryKey: ["studio", slug], queryFn: () => getStudioProfile(client, slug), enabled: !!slug });
}
