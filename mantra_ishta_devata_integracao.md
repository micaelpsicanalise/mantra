# Ishta Devata — integração no app/index.html

Depois de rodar `mantra_ishta_devata_schema.sql` (que já cria as tabelas e
liga as 7 deidades ao catálogo existente), faltam 3 mudanças no
`app/index.html`: uma tela de quiz, uma tela de resultado, e um card novo
na Home que aparece só depois que a pessoa escolheu sua divindade.

Isso segue exatamente o mesmo padrão de `showView()` / `appState` que já
existe no arquivo — não é uma arquitetura nova, é mais duas `<section
class="view">` e mais um pedaço de estado.

---

## 1. Perguntas do quiz (método Bhava — atração/necessidade, não astrologia)

5 perguntas, cada opção soma ponto pra uma deidade. No fim, a deidade com
mais pontos "vence" (empate = a de menor `ordem`, i.e. a primeira da lista).

```js
const ISHTA_QUIZ = [
  {
    pergunta: "O que mais pesa pra você agora?",
    opcoes: [
      { texto: "Mente cheia, difícil ter silêncio", peso: { shiva: 2 } },
      { texto: "Falta de direção, decisões travadas", peso: { ganesha: 2 } },
      { texto: "Instabilidade financeira", peso: { lakshmi: 2 } },
      { texto: "Medo ou insegurança constante", peso: { durga: 2 } },
    ],
  },
  {
    pergunta: "Se pudesse mudar uma coisa em você amanhã, seria...",
    opcoes: [
      { texto: "Ter mais coragem de cortar o que não serve", peso: { kali: 2 } },
      { texto: "Amar e viver mais leve, com menos peso", peso: { krishna: 2 } },
      { texto: "Ter mais foco e clareza mental", peso: { saraswati: 2 } },
      { texto: "Ter mais paz e menos reatividade", peso: { shiva: 1, durga: 1 } },
    ],
  },
  {
    pergunta: "Qual palavra combina mais com o que você busca?",
    opcoes: [
      { texto: "Proteção", peso: { durga: 2 } },
      { texto: "Abundância", peso: { lakshmi: 2 } },
      { texto: "Sabedoria", peso: { saraswati: 1, ganesha: 1 } },
      { texto: "Transformação", peso: { kali: 2 } },
    ],
  },
  {
    pergunta: "Diante de um problema difícil, você tende a...",
    opcoes: [
      { texto: "Recuar e buscar silêncio antes de agir", peso: { shiva: 2 } },
      { texto: "Agir com o coração, mesmo sem certeza", peso: { krishna: 2 } },
      { texto: "Pensar em todos os ângulos antes de decidir", peso: { saraswati: 2 } },
      { texto: "Encarar de frente, sem medo do confronto", peso: { kali: 1, durga: 1 } },
    ],
  },
  {
    pergunta: "Qual dessas frases mais soa como você?",
    opcoes: [
      { texto: "Preciso começar de novo em algo", peso: { ganesha: 2 } },
      { texto: "Preciso de coragem pra romper um padrão", peso: { kali: 1, durga: 1 } },
      { texto: "Preciso de leveza e alegria no dia a dia", peso: { krishna: 2 } },
      { texto: "Preciso de estabilidade material", peso: { lakshmi: 2 } },
    ],
  },
];
```

## 2. HTML — duas telas novas (colar antes do `</div>` que fecha `.device`)

```html
<!-- ================= QUIZ ISHTA DEVATA ================= -->
<section id="view-quiz" class="view">
  <div class="detail-head">
    <span class="back-btn" onclick="showView('perfil')">‹</span>
    <div><p class="detail-title">Sua divindade de conexão</p>
      <p class="detail-sub" id="quiz-progresso">Pergunta 1 de 5</p></div>
  </div>
  <h3 style="font-size:16px; margin-bottom:18px;" id="quiz-pergunta">—</h3>
  <div id="quiz-opcoes" style="display:flex; flex-direction:column; gap:10px;"></div>
</section>

<!-- ================= RESULTADO ISHTA DEVATA ================= -->
<section id="view-ishta-resultado" class="view">
  <div class="detail-head">
    <span class="back-btn" onclick="showView('perfil')">‹</span>
    <div><p class="detail-title">Sua divindade de conexão</p></div>
  </div>
  <div style="text-align:center; margin-bottom:18px;">
    <div class="avatar-circle" id="ishta-inicial" style="width:72px;height:72px;font-size:28px;">?</div>
    <h2 id="ishta-nome" style="font-size:22px; margin-top:10px;">—</h2>
    <p class="eyebrow" id="ishta-arquetipo" style="margin-top:4px;">—</p>
  </div>
  <p class="body-text" id="ishta-descricao"></p>
  <button class="btn-primary" onclick="onVerYantraIshta()">Ver yantra e mantra</button>
  <button class="signout-btn" onclick="showView('quiz'); iniciarQuiz();">Refazer o quiz</button>
</section>
```

## 3. JS — lógica do quiz, resultado e persistência

```js
appState.quiz = { indice: 0, pontos: {} };
appState.ishtaDevata = null; // { deidade, yantra, mantra }

function iniciarQuiz() {
  appState.quiz = { indice: 0, pontos: {} };
  renderPerguntaQuiz();
}

function renderPerguntaQuiz() {
  const q = ISHTA_QUIZ[appState.quiz.indice];
  document.getElementById("quiz-progresso").textContent =
    `Pergunta ${appState.quiz.indice + 1} de ${ISHTA_QUIZ.length}`;
  document.getElementById("quiz-pergunta").textContent = q.pergunta;
  document.getElementById("quiz-opcoes").innerHTML = q.opcoes.map((op, i) => `
    <div class="list-item" onclick="onResponderQuiz(${i})">
      <div class="meta"><p class="title">${esc(op.texto)}</p></div>
      <span class="chev">›</span>
    </div>`).join("");
}

function onResponderQuiz(indiceOpcao) {
  const q = ISHTA_QUIZ[appState.quiz.indice];
  const peso = q.opcoes[indiceOpcao].peso;
  for (const slug in peso) {
    appState.quiz.pontos[slug] = (appState.quiz.pontos[slug] || 0) + peso[slug];
  }
  appState.quiz.indice++;
  if (appState.quiz.indice < ISHTA_QUIZ.length) {
    renderPerguntaQuiz();
  } else {
    finalizarQuiz();
  }
}

async function finalizarQuiz() {
  const pontos = appState.quiz.pontos;
  const slugVencedor = Object.keys(pontos).sort((a, b) => pontos[b] - pontos[a])[0];

  const { data: deidade } = await supabaseClient
    .from("mantra_deidades").select("*").eq("slug", slugVencedor).maybeSingle();
  if (!deidade) return;

  await supabaseClient.from("mantra_perfil_espiritual").upsert({
    user_id: appState.user.id, deidade_id: deidade.id, metodo: "quiz",
  });

  await loadIshtaDevata();
  mostrarResultadoIshta(deidade);
}

async function loadIshtaDevata() {
  const { data } = await supabaseClient
    .from("mantra_perfil_espiritual")
    .select("*, mantra_deidades(*)")
    .eq("user_id", appState.user.id)
    .maybeSingle();
  appState.ishtaDevata = data?.mantra_deidades || null;
  renderIshtaCardHome(); // ver seção 4
}

function mostrarResultadoIshta(deidade) {
  document.getElementById("ishta-inicial").textContent = deidade.nome.charAt(0);
  document.getElementById("ishta-nome").textContent = deidade.nome;
  document.getElementById("ishta-arquetipo").textContent = deidade.arquetipo;
  document.getElementById("ishta-descricao").textContent = deidade.descricao;
  showView("ishta-resultado");
}

function onVerYantraIshta() {
  if (appState.ishtaDevata?.yantra_id) return onOpenYantra(appState.ishtaDevata.yantra_id);
  if (appState.ishtaDevata?.mantra_id) return onOpenMantra(appState.ishtaDevata.mantra_id);
}
```

**Chame `await loadIshtaDevata();`** dentro de `checkSession()`, junto dos
outros `loadCatalogo()/loadHome()/loadPerfil()` — assim o app já sabe se a
pessoa tem uma divindade escolhida antes de montar a Home.

## 4. Card novo na Home (persistente, ao lado do "Prática do dia")

```js
function renderIshtaCardHome() {
  const el = document.getElementById("ishta-home-card");
  if (!appState.ishtaDevata) {
    el.innerHTML = `
      <div class="quick-card" onclick="showView('quiz'); iniciarQuiz();">
        <p class="name">Descubra sua divindade de conexão</p>
        <p class="count">Quiz de 5 perguntas</p>
      </div>`;
  } else {
    const d = appState.ishtaDevata;
    el.innerHTML = `
      <div class="quick-card" onclick="onVerYantraIshta()">
        <p class="name">${esc(d.nome)}</p>
        <p class="count">Sua divindade de conexão</p>
      </div>`;
  }
}
```

Coloque `<div id="ishta-home-card" style="margin-bottom:16px;"></div>` logo
abaixo do `.day-card` no `view-home`, e adicione um botão em `view-perfil`
("Escolher / trocar minha divindade de conexão" → `showView('quiz');
iniciarQuiz();`) pra quem quiser refazer.

---

## Sobre o "modo Jyotish" (cálculo astrológico real)

Se decidir avançar pra isso depois, o desenho muda de figura: em vez de um
quiz, a tela pede **data, hora exata e cidade de nascimento**, e o backend
chama uma API de astrologia védica (ex. Prokerala, FreeAstrologyAPI —
ambas calculam Navamsha/D9 com ayanamsa sideral Lahiri) pra descobrir o
regente da 9ª casa divisional. Isso não dá pra aproximar com regra caseira
— exige efeméride real, então ou paga uma API pronta ou embarca uma lib
como Swiss Ephemeris. Recomendo só entrar nisso se o quiz mostrar que as
pessoas realmente querem uma segunda camada "mais séria" — o
`metodo: 'jyotish'` já está previsto no schema pra esse dia.
