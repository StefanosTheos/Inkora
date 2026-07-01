-- =====================================================================
-- 0019  CANONICAL TATTOO STYLES (reference data — deploys everywhere)
-- ---------------------------------------------------------------------
-- This is the single source of truth for the style taxonomy used by
-- onboarding, discovery filters, portfolio tagging and Create Idea.
-- Idempotent: safe to re-run. Add new styles here in future migrations.
-- =====================================================================
insert into public.tattoo_styles (slug, name, description, sort_order) values
  ('fineline',        'Fine Line',        'Delicate, thin single-needle line work.',         10),
  ('blackwork',       'Blackwork',        'Bold solid black designs and patterns.',          20),
  ('traditional',     'Traditional',      'Classic American bold lines and limited palette.',30),
  ('neo_traditional', 'Neo Traditional',  'Modern take on traditional with richer color.',   40),
  ('realism',         'Realism',          'Photorealistic portraits and imagery.',           50),
  ('watercolor',      'Watercolor',       'Painterly, soft-edged color washes.',             60),
  ('japanese',        'Japanese',         'Irezumi-inspired motifs and composition.',        70),
  ('geometric',       'Geometric',        'Precise shapes, symmetry and sacred geometry.',   80),
  ('dotwork',         'Dotwork',          'Stippled shading built from dots.',               90),
  ('lettering',       'Lettering',        'Script, calligraphy and typographic tattoos.',   100)
on conflict (slug) do nothing;
