-- ============================================================
-- Mantra — schema adicional no MESMO projeto Supabase do Umbanda
-- (aewcxqzpbipwcdpsjfht, São Paulo). Tabelas com prefixo mantra_
-- pra não colidir com nada do Umbanda (guias, conteudos, escutas,
-- get_streak, etc. continuam intactos).
--
-- Reaproveita a tabela `profiles` e o trigger `handle_new_user`
-- que já existem — não recriar.
--
-- Áudio (mantras/yoga) e imagem (yantras) ficam no MESMO bucket R2
-- do Umbanda, só com prefixo "mantra-" no nome do arquivo pra
-- organizar — nenhuma mudança necessária no Worker.
-- ============================================================

-- ------------------------------------------------------------
-- 1. MANTRAS
-- ------------------------------------------------------------
create table public.mantra_mantras (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,                   -- 'Gayatri Mantra'
  texto_sanscrito text,                 -- devanágari ou transliteração formatada
  transliteracao text,
  traducao text,
  significado text,                     -- explicação mais longa
  categoria text,                       -- 'bija', 'gayatri', 'shanti', livre
  audio_url text,
  duracao_segundos int,
  voz text,
  ordem int default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. YANTRAS (catálogo visual — sem áudio obrigatório)
-- ------------------------------------------------------------
create table public.mantra_yantras (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,                   -- 'Sri Yantra'
  imagem_url text,
  significado text,
  deidade_associada text,
  ordem int default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. PRÁTICAS DE YOGA (áudio guiado, opcional)
-- ------------------------------------------------------------
create table public.mantra_praticas_yoga (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  tipo text check (tipo in ('asana', 'pranayama', 'meditacao')),
  nivel text check (nivel in ('iniciante', 'intermediario', 'avancado')),
  descricao text,
  audio_url text,
  duracao_segundos int,
  ordem int default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. TEXTOS (leituras — Bhagavad Gita, Upanishads, etc.)
-- ------------------------------------------------------------
create table public.mantra_textos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  corpo text not null,
  fonte text,                           -- 'Bhagavad Gita 2.47'
  ordem int default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. PRÁTICA DO DIA — aponta pra um item de qualquer catálogo
-- ------------------------------------------------------------
create table public.mantra_pratica_do_dia (
  dia_semana int primary key check (dia_semana between 0 and 6),
  tipo text not null check (tipo in ('mantra', 'yantra', 'yoga', 'texto')),
  referencia_id uuid not null
);

-- ------------------------------------------------------------
-- 6. SESSÕES — log de atividade/meditação (streak do dashboard)
-- ------------------------------------------------------------
create table public.mantra_sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('mantra', 'yantra', 'yoga', 'texto')),
  referencia_id uuid not null,
  duracao_segundos int,
  concluido_em timestamptz not null default now()
);

create index mantra_sessoes_user_id_idx on public.mantra_sessoes(user_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.mantra_mantras enable row level security;
alter table public.mantra_yantras enable row level security;
alter table public.mantra_praticas_yoga enable row level security;
alter table public.mantra_textos enable row level security;
alter table public.mantra_pratica_do_dia enable row level security;
alter table public.mantra_sessoes enable row level security;

-- Catálogo: leitura pública, escrita só admin (mesmo UUID do Umbanda,
-- é a mesma pessoa administrando os dois apps)
create policy "mantras: leitura pública" on public.mantra_mantras for select using (true);
create policy "mantras: escrita admin" on public.mantra_mantras for all
  using (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid)
  with check (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid);

create policy "yantras: leitura pública" on public.mantra_yantras for select using (true);
create policy "yantras: escrita admin" on public.mantra_yantras for all
  using (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid)
  with check (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid);

create policy "praticas_yoga: leitura pública" on public.mantra_praticas_yoga for select using (true);
create policy "praticas_yoga: escrita admin" on public.mantra_praticas_yoga for all
  using (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid)
  with check (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid);

create policy "textos: leitura pública" on public.mantra_textos for select using (true);
create policy "textos: escrita admin" on public.mantra_textos for all
  using (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid)
  with check (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid);

create policy "pratica_do_dia: leitura pública" on public.mantra_pratica_do_dia for select using (true);
create policy "pratica_do_dia: escrita admin" on public.mantra_pratica_do_dia for all
  using (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid)
  with check (auth.uid() = 'af619e44-1049-4ebd-86b4-4b4fa3bce94b'::uuid);

-- Sessões: dado de usuário, privado
create policy "sessoes: usuário vê as próprias" on public.mantra_sessoes for select
  using (auth.uid() = user_id);
create policy "sessoes: usuário registra as próprias" on public.mantra_sessoes for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Funções auxiliares (nomes distintos das do Umbanda, mesmo
-- projeto — get_streak/get_total_ouvidos já existem e continuam
-- servindo só o Umbanda)
-- ============================================================
create or replace function public.get_mantra_streak(p_user_id uuid)
returns int
language sql
stable
as $$
  with dias as (
    select distinct concluido_em::date as dia
    from public.mantra_sessoes
    where user_id = p_user_id
    order by dia desc
  ),
  numerados as (
    select dia, row_number() over (order by dia desc) as rn
    from dias
  ),
  consecutivos as (
    select dia, dia + (rn || ' days')::interval as ancora
    from numerados
  )
  select count(*)::int
  from consecutivos
  where ancora = (select ancora from consecutivos limit 1)
    and dia >= (
      case when (select max(dia) from dias) >= current_date - 1
        then (select min(dia) from consecutivos where ancora = (select ancora from consecutivos limit 1))
        else current_date + 1
      end
    );
$$;

create or replace function public.get_mantra_total_sessoes(p_user_id uuid)
returns int
language sql
stable
as $$
  select count(*)::int from public.mantra_sessoes where user_id = p_user_id;
$$;

create or replace view public.mantra_pratica_do_dia_hoje as
select * from public.mantra_pratica_do_dia
where dia_semana = extract(dow from now())::int;
