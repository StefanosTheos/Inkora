# Generative-preview interface and mock

This package defines the `AiPreviewService` contract and `MockAiPreviewService`. It contains **no model, inference service or implemented generative tattoo-preview pipeline**. The mock returns a draft/queued state without a generated result image; schema and interface presence are not evidence of working AI generation.

This is distinct from **mobile try-on**, which is implemented outside this package. The mobile `TryOnScreen`/`TattooCompositor` combines an existing artist flash image with a user-selected photo on-device and can save the composite. It does not generate a new tattoo with an AI model.

The web preview surface is read-only: it explains mobile try-on, shows example styles and lists saved mobile results. It does not implement browser compositing or server-side generation.

Keep the generative-service boundary explicit until a real implementation, rights review, safety behavior and evaluation are available. See [the feature matrix](../README.md) and [roadmap](../docs/ROADMAP.md).
