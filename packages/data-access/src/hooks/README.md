# data-access/hooks

App-facing TanStack Query hooks — the surface apps actually consume. Three kinds:

- **query**: `useArtist`, `useArtistSearch`, `useFeed`, `useConversations`, `useMessages`, `useRewards`, `useNotifications`, `useAiPreview`
- **mutation**: `useSendMessage`, `useSaveIdea`, `useSubmitBookingRequest`, `useAcceptOffer` (→ Edge), `useRegisterDevice`
- **realtime**: `useConversationRealtime`, `usePresence`, `useNotificationsRealtime`

Conventions:
- cursor pagination via `useInfiniteQuery`
- optimistic updates + rollback for saves/messages/requests
- errors surface as the domain `AppError` taxonomy
- realtime hooks write into the cache keyed by `queryKeys.*`

**TODO:** implement. Files below are signature stubs only (no business logic).
