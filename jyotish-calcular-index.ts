// supabase/functions/jyotish-calcular/index.ts
//
// Recebe dados de nascimento, calcula o Ishta Devata por Jyotish
// (mesma lógica validada em jyotish_engine.py / jyotish_engine_test.js)
// e grava o resultado em mantra_perfil_espiritual com metodo='jyotish'.
//
// Deploy: supabase functions deploy jyotish-calcular
// Chamada (do app): supabaseClient.functions.invoke('jyotish-calcular', { body: {...} })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ------------------------------------------------------------
// Motor Jyotish (idêntico ao validado em Python/Node)
// ------------------------------------------------------------
function norm360(x: number): number { x = x % 360; return x < 0 ? x + 360 : x; }
const sind = (x: number) => Math.sin(x * Math.PI / 180);
const cosd = (x: number) => Math.cos(x * Math.PI / 180);
const tand = (x: number) => Math.tan(x * Math.PI / 180);
const atan2d = (y: number, x: number) => Math.atan2(y, x) * 180 / Math.PI;

function julianDay(dtUtc: Date): number {
  let y = dtUtc.getUTCFullYear();
  let m = dtUtc.getUTCMonth() + 1;
  const d = dtUtc.getUTCDate() + (dtUtc.getUTCHours() + dtUtc.getUTCMinutes() / 60 + dtUtc.getUTCSeconds() / 3600) / 24;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

type Elements = { a: [number, number]; e: [number, number]; I: [number, number]; L: [number, number]; pi: [number, number]; Om: [number, number] };

const PLANET_ELEMENTS: Record<string, Elements> = {
  mercurio: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175], pi: [77.45779628, 0.16047689], Om: [48.33076593, -0.12534081] },
  venus:    { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], pi: [131.60246718, 0.00268329], Om: [76.67984255, -0.27769418] },
  terra:    { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], pi: [102.93768193, 0.32327364], Om: [0.0, 0.0] },
  marte:    { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], pi: [-23.94362959, 0.44441088], Om: [49.55953891, -0.29257343] },
  jupiter:  { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], pi: [14.72847983, 0.21252668], Om: [100.47390909, 0.20469106] },
  saturno:  { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], pi: [92.59887831, -0.41897216], Om: [113.66242448, -0.28867794] },
};

function heliocentricXYZ(planet: string, T: number): [number, number, number] {
  const el = PLANET_ELEMENTS[planet];
  const a = el.a[0] + el.a[1] * T;
  const e = el.e[0] + el.e[1] * T;
  const I = el.I[0] + el.I[1] * T;
  const L = el.L[0] + el.L[1] * T;
  const pi_ = el.pi[0] + el.pi[1] * T;
  const Om = el.Om[0] + el.Om[1] * T;
  const w = pi_ - Om;

  const M = norm360(L - pi_);
  const Mrad = M * Math.PI / 180;
  let E = Mrad + e * Math.sin(Mrad);
  for (let i = 0; i < 50; i++) {
    const dE = (Mrad - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const wR = w * Math.PI / 180, OmR = Om * Math.PI / 180, IR = I * Math.PI / 180;
  const cosw = Math.cos(wR), sinw = Math.sin(wR);
  const cosOm = Math.cos(OmR), sinOm = Math.sin(OmR);
  const cosI = Math.cos(IR), sinI = Math.sin(IR);

  const x = (cosw * cosOm - sinw * sinOm * cosI) * xp + (-sinw * cosOm - cosw * sinOm * cosI) * yp;
  const y = (cosw * sinOm + sinw * cosOm * cosI) * xp + (-sinw * sinOm + cosw * cosOm * cosI) * yp;
  const z = (sinw * sinI) * xp + (cosw * sinI) * yp;
  return [x, y, z];
}

function precessaoDesdeJ2000(T: number): number {
  const arcsec = 5029.0966 * T + 1.11113 * T * T;
  return arcsec / 3600;
}

function geocentricLongitude(planet: string, T: number): number {
  const [xp, yp] = heliocentricXYZ(planet, T);
  const [xe, ye] = heliocentricXYZ("terra", T);
  const lonJ2000 = norm360(atan2d(yp - ye, xp - xe));
  return norm360(lonJ2000 + precessaoDesdeJ2000(T));
}

function sunLongitude(T: number): number {
  const [xe, ye] = heliocentricXYZ("terra", T);
  const lonJ2000 = norm360(atan2d(-ye, -xe));
  return norm360(lonJ2000 + precessaoDesdeJ2000(T));
}

function moonLongitude(T: number): number {
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T ** 2 + T ** 3 / 538841 - T ** 4 / 65194000);
  const D  = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T ** 2 + T ** 3 / 545868 - T ** 4 / 113065000);
  const M  = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T ** 2 + T ** 3 / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T ** 2 + T ** 3 / 69699 - T ** 4 / 14712000);
  const F  = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T ** 2 - T ** 3 / 3526000 + T ** 4 / 863310000);

  const terms: [number, number, number, number, number][] = [
    [0, 0, 1, 0, 6.288774], [2, 0, -1, 0, 1.274027], [2, 0, 0, 0, 0.658314],
    [0, 0, 2, 0, 0.213618], [0, 1, 0, 0, -0.185116], [0, 0, 0, 2, -0.114332],
    [2, 0, -2, 0, 0.058793], [2, -1, -1, 0, 0.057066], [2, 0, 1, 0, 0.053322],
    [2, -1, 0, 0, 0.045758], [0, 1, -1, 0, -0.040923], [1, 0, 0, 0, -0.034720],
    [0, 1, 1, 0, -0.030383], [2, 0, 0, -2, 0.015327], [0, 0, 1, 2, -0.012528],
    [0, 0, 1, -2, 0.010980], [4, 0, -1, 0, 0.010675], [0, 0, 3, 0, 0.010034],
    [4, 0, -2, 0, 0.008548], [2, 1, -1, 0, -0.007888], [2, 1, 0, 0, -0.006766],
    [1, 0, -1, 0, -0.005163], [1, 1, 0, 0, 0.004987], [2, -1, 1, 0, 0.004036],
    [2, 0, 2, 0, 0.003994],
  ];
  let total = 0;
  for (const [d, m, mp, f, coef] of terms) {
    total += coef * sind(d * D + m * M + mp * Mp + f * F);
  }
  return norm360(Lp + total);
}

function rahuLongitude(T: number): number {
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T ** 2 + T ** 3 / 467441 - T ** 4 / 60616000);
}

function ayanamsaLahiri(jd: number): number {
  const yearsFrom2000 = (jd - 2451545.0) / 365.25;
  return 23.85370 + yearsFrom2000 * (50.2388475 / 3600);
}

function obliquity(T: number): number {
  return 23.43929111 - 0.0130041667 * T - 0.00000016389 * T ** 2 + 0.00000050361 * T ** 3;
}

function gmstDegrees(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T ** 2 - T ** 3 / 38710000;
  return norm360(gmst);
}

function ascendantTropical(jd: number, lat: number, lonEast: number): number {
  const T = (jd - 2451545.0) / 36525;
  const ramc = norm360(gmstDegrees(jd) + lonEast);
  const eps = obliquity(T);
  const y = -cosd(ramc);
  const x = sind(eps) * tand(lat) + cosd(eps) * sind(ramc);
  return norm360(atan2d(y, x));
}

const SIGNOS = ["Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"];
const REGENTES: Record<string, string> = { "Áries": "marte", "Touro": "venus", "Gêmeos": "mercurio", "Câncer": "lua", "Leão": "sol", "Virgem": "mercurio", "Libra": "venus", "Escorpião": "marte", "Sagitário": "jupiter", "Capricórnio": "saturno", "Aquário": "saturno", "Peixes": "jupiter" };
const PLANETA_DEIDADE: Record<string, string> = { sol: "shiva", lua: "krishna", marte: "kali", mercurio: "ganesha", jupiter: "krishna", venus: "lakshmi", saturno: "shiva", rahu: "kali", ketu: "ganesha" };

function signoDe(lon: number): number { return Math.floor(norm360(lon) / 30) % 12; }
function navamshaSigno(lon: number): number {
  lon = norm360(lon);
  const signo = signoDe(lon);
  const grauNoSigno = lon % 30;
  const parte = Math.floor(grauNoSigno / (30 / 9));
  const elemento = signo % 4;
  const inicio = ({ 0: 0, 1: 9, 2: 6, 3: 3 } as Record<number, number>)[elemento];
  return (inicio + parte) % 12;
}

interface EntradaNascimento {
  data: string;             // 'AAAA-MM-DD'
  hora: string;             // 'HH:MM' (hora local)
  utcOffsetHoras: number;   // ex. -3
  latitude: number;
  longitudeLeste: number;
}

function calcularMapa({ data, hora, utcOffsetHoras, latitude, longitudeLeste }: EntradaNascimento) {
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const dtLocal = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const dtUtc = new Date(dtLocal.getTime() - utcOffsetHoras * 3600 * 1000);

  const jd = julianDay(dtUtc);
  const T = (jd - 2451545.0) / 36525;
  const ayanamsa = ayanamsaLahiri(jd);

  const tropicais: Record<string, number> = {
    sol: sunLongitude(T),
    lua: moonLongitude(T),
    mercurio: geocentricLongitude("mercurio", T),
    venus: geocentricLongitude("venus", T),
    marte: geocentricLongitude("marte", T),
    jupiter: geocentricLongitude("jupiter", T),
    saturno: geocentricLongitude("saturno", T),
  };
  const rahuT = rahuLongitude(T);
  tropicais.rahu = rahuT;
  tropicais.ketu = norm360(rahuT + 180);

  const ascTrop = ascendantTropical(jd, latitude, longitudeLeste);

  const sideral: Record<string, number> = {};
  for (const p in tropicais) sideral[p] = norm360(tropicais[p] - ayanamsa);
  const ascSideral = norm360(ascTrop - ayanamsa);

  const grahs: Record<string, any> = {};
  for (const p in sideral) {
    const lon = sideral[p];
    grahs[p] = {
      longitudeSideral: Math.round(lon * 10000) / 10000,
      signo: SIGNOS[signoDe(lon)],
      grauNoSigno: Math.round((lon % 30) * 100) / 100,
      navamshaSigno: SIGNOS[navamshaSigno(lon)],
    };
  }
  grahs.ascendente = {
    longitudeSideral: Math.round(ascSideral * 10000) / 10000,
    signo: SIGNOS[signoDe(ascSideral)],
    grauNoSigno: Math.round((ascSideral % 30) * 100) / 100,
    navamshaSigno: SIGNOS[navamshaSigno(ascSideral)],
  };

  const candidatos = ["sol", "lua", "mercurio", "venus", "marte", "jupiter", "saturno"];
  const atmakaraka = candidatos.reduce((best, p) => grahs[p].grauNoSigno > grahs[best].grauNoSigno ? p : best, candidatos[0]);

  const akNavamshaIdx = SIGNOS.indexOf(grahs[atmakaraka].navamshaSigno);
  const signoIshtaIdx = (akNavamshaIdx - 1 + 12) % 12;
  const signoIshta = SIGNOS[signoIshtaIdx];
  const regenteIshta = REGENTES[signoIshta];
  const deidadeSlug = PLANETA_DEIDADE[regenteIshta] ?? null;

  return {
    ayanamsaUsadoGraus: Math.round(ayanamsa * 10000) / 10000,
    jd,
    grahs,
    atmakaraka,
    atmakarakaNavamsha: grahs[atmakaraka].navamshaSigno,
    signoIshtaDevata: signoIshta,
    planetaRegenteIshta: regenteIshta,
    deidadeSlugSugerida: deidadeSlug,
  };
}

// ------------------------------------------------------------
// Handler HTTP
// ------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sem autenticação." }), { status: 401, headers: CORS_HEADERS });
    }

    const body = await req.json();
    const { data, hora, utcOffsetHoras, latitude, longitudeLeste } = body as EntradaNascimento;

    if (!data || !hora || utcOffsetHoras === undefined || latitude === undefined || longitudeLeste === undefined) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: data, hora, utcOffsetHoras, latitude, longitudeLeste." }), { status: 400, headers: CORS_HEADERS });
    }
    if (latitude < -90 || latitude > 90 || longitudeLeste < -180 || longitudeLeste > 180) {
      return new Response(JSON.stringify({ error: "Latitude/longitude fora do intervalo válido." }), { status: 400, headers: CORS_HEADERS });
    }

    const resultado = calcularMapa({ data, hora, utcOffsetHoras, latitude, longitudeLeste });

    // Cliente autenticado como o próprio usuário (respeita RLS)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }), { status: 401, headers: CORS_HEADERS });
    }

    let deidadeCompleta = null;
    if (resultado.deidadeSlugSugerida) {
      const { data: deidade } = await supabaseClient
        .from("mantra_deidades").select("*").eq("slug", resultado.deidadeSlugSugerida).maybeSingle();

      if (deidade) {
        deidadeCompleta = deidade;
        await supabaseClient.from("mantra_perfil_espiritual").upsert({
          user_id: user.id, deidade_id: deidade.id, metodo: "jyotish",
        });
      }
    }

    return new Response(JSON.stringify({ ...resultado, deidade: deidadeCompleta }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Não foi possível calcular. Confira os dados e tente de novo." }), { status: 500, headers: CORS_HEADERS });
  }
});
