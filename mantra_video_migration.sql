-- ============================================================
-- Adiciona suporte a vídeo nas práticas de yoga (ásanas)
-- Rodar depois de mantra_schema.sql / mantra_seed.sql
-- ============================================================

alter table public.mantra_praticas_yoga
  add column video_url text;

comment on column public.mantra_praticas_yoga.video_url is
  'URL do vídeo no R2 (mesmo bucket do áudio, prefixo "mantra-"). Quando preenchido, o app mostra o vídeo no lugar do player de áudio.';
