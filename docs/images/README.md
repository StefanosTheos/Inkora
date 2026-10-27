# Inkora screenshot gallery

Nine owner-supplied Android application captures, added on 27 October 2026.
The screens show the mobile prototype with controlled fictional demo accounts,
conversations, appointments and business activity. Revenue, ratings and user
counts shown are demonstration fixtures, not production results.

## Image preparation

Each source was 1080 × 2340 pixels. The retained rectangle is
`(left=0, top=96, right=1080, bottom=2200)` with exclusive right/bottom bounds,
producing **1080 × 2104** images. This removes the phone's battery/notification
status bar and three-button Android navigation bar while retaining Inkora's
headers, bottom tabs, message composer and action buttons.

The images are lossless WebP exports. Their decoded pixels were verified to
match the corresponding source crop exactly. There is no UI repainting,
retouching, resizing, invented content or decorative device frame. The README
displays each at 240 pixels wide and links to its full-resolution version.
Raw supplied captures remain outside Inkora's committed gallery; the filenames
below identify the source files from the shared project's local `Pics/` folder.

## Captures

| Export | Role / screen | Supplied source |
| --- | --- | --- |
| [seeker-discovery.webp](seeker-discovery.webp) | Seeker discovery | `inkora-landing_page.jpg` |
| [artist-home.webp](artist-home.webp) | Artist workspace | `inkora-artist_landing_page.jpg` |
| [studio-overview.webp](studio-overview.webp) | Studio overview | `inkora-studio_landing_page.jpg` |
| [design-exploration.webp](design-exploration.webp) | Explore designs | `inkora-explore-deisgns.jpg` |
| [booking-review.webp](booking-review.webp) | Booking request | `inkora-final_booking_step.jpg` |
| [booking-conversation.webp](booking-conversation.webp) | Chat and offers | `inkora-chat.jpg` |
| [seeker-profile.webp](seeker-profile.webp) | Seeker profile | `inkora-client_dashboard.jpg` |
| [try-on-library.webp](try-on-library.webp) | Try-on library | `inkora-try_on_page.jpg` |
| [studio-team.webp](studio-team.webp) | Studio team | `inkora-studio_team_management.jpg` |

## Interpretation and provenance

The booking review capture is the final request-review step, not a completed
payment. The conversation includes a pending live booking-offer card. The
try-on capture shows saved photo composites and flash selection, not model
generation. Artist availability and other switches reflect the captured state.

The application revision used to capture these screens was not supplied;
the processing date is not a claim of an exact build revision or capture time.
Screenshots include existing demo artwork and imagery. Their underlying asset
permissions remain part of the separate [third-party rights review](../../THIRD_PARTY_NOTICES.md);
preparing this gallery does not establish additional rights in that material.
