-- ============================================================
-- Seed — alguns itens de exemplo pra testar o app antes de
-- popular o catálogo de verdade pelo admin.
-- ============================================================

insert into public.mantra_mantras (slug, nome, texto_sanscrito, transliteracao, traducao, significado, categoria, ordem) values
('gayatri', 'Gayatri Mantra',
 'ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्',
 'Om bhūr bhuvaḥ svaḥ tat savitur vareṇyaṃ bhargo devasya dhīmahi dhiyo yo naḥ pracodayāt',
 'Que possamos meditar na luz gloriosa daquele que criou o universo; que essa luz ilumine nossas mentes.',
 'Um dos mantras mais antigos e reverenciados do hinduísmo, dedicado à divindade solar Savitr, pedindo clareza e iluminação da mente.',
 'gayatri', 1),
('om-shanti', 'Om Shanti Shanti Shanti',
 'ॐ शान्तिः शान्तिः शान्तिः',
 'Om Śāntiḥ Śāntiḥ Śāntiḥ',
 'Om, paz, paz, paz.',
 'Invocação de paz repetida três vezes — corpo, mente e espírito, ou paz interior, paz com os outros, paz com o universo.',
 'shanti', 2);

insert into public.mantra_yantras (slug, nome, significado, deidade_associada, ordem) values
('sri-yantra', 'Sri Yantra',
 'Considerado o yantra mais complexo e sagrado, formado por nove triângulos entrelaçados representando a união do masculino e feminino, o cosmos se expandindo a partir de um ponto central (bindu).',
 'Devi (Tripura Sundari)', 1);

insert into public.mantra_praticas_yoga (slug, nome, tipo, nivel, descricao, ordem) values
('respiracao-4-7-8', 'Respiração 4-7-8', 'pranayama', 'iniciante',
 'Técnica de respiração calmante: inspire por 4 segundos, segure por 7, expire por 8.', 1);

insert into public.mantra_textos (slug, titulo, corpo, fonte, ordem) values
('bhagavad-gita-2-47', 'Sobre o dever sem apego ao resultado',
 'Você tem direito à ação, mas nunca aos frutos da ação. Não considere a si mesmo a causa dos resultados de suas atividades, e nunca se apegue à inação.',
 'Bhagavad Gita, capítulo 2, verso 47', 1);

-- Prática do dia: exemplo simples, terça = Gayatri Mantra
insert into public.mantra_pratica_do_dia (dia_semana, tipo, referencia_id)
select 2, 'mantra', id from public.mantra_mantras where slug = 'gayatri';
