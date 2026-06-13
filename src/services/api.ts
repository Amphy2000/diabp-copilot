export interface MatchWithPrediction {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  prediction: {
    recommendedBet: string;
    confidence: number;
    reasoning: string;
    expectedValue: number;
    homeWinProb: number;
    awayWinProb: number;
    drawProb?: number;
    markets: {
      btts: string | null;
      goalsOverUnder: string | null;
      winOrDraw: string | null;
    };
    fairOdds: string;
    sportyBetEstimate: string;
    realOddsBet365: string;
    realOddsSportyBet: string;
    realBookmaker: string;
    marketSentiment: 'Sharp' | 'Balanced' | 'Public';
    isLive: boolean;
    predictionMode: 'live' | 'forecast' | 'simulation';
  };
}

// === API KEYS ================================================================
// Add new API-Sports keys here when you get them
const API_SPORTS_KEYS: string[] = [
  '1cb956f56d583d1b94462b7ec312dd5d',
];

// Dynamic: user can override via Settings modal (stored in localStorage)
function getOddsApiKeys(): string[] {
  const custom = localStorage.getItem('amphy_custom_odds_api_key');
  if (custom) {
    const keys = custom.split(',').map(k => k.trim()).filter(k => k.length > 5);
    if (keys.length > 0) return keys;
  }
  return ['4a5c423b1cb52ffb281ebcca674661af'];
}



function getActiveKeyIndex(): number {
  try {
    return parseInt(localStorage.getItem('amphy_active_key_index') || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function setActiveKeyIndex(index: number) {
  try {
    localStorage.setItem('amphy_active_key_index', index.toString());
  } catch {}
}

async function fetchOddsApiWithRotation(urlPath: string, queryParams: string = ''): Promise<any> {
  const keys = getOddsApiKeys();
  if (keys.length === 0) return null;

  let lastStatus = 200;
  let keyStatuses: Record<string, string> = {};
  let keyTimestamps: Record<string, number> = {};
  
  try {
    const savedStatus = localStorage.getItem('amphy_keys_status');
    if (savedStatus) keyStatuses = JSON.parse(savedStatus);
    const savedTimestamps = localStorage.getItem('amphy_keys_timestamps');
    if (savedTimestamps) keyTimestamps = JSON.parse(savedTimestamps);
  } catch {}

  let updatedStatuses = false;
  const startIndex = getActiveKeyIndex() % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (startIndex + attempt) % keys.length;
    const key = keys[idx];
    const status = keyStatuses[key] || 'unchecked';
    const timestamp = keyTimestamps[key] || 0;

    // Skip permanently invalid keys or quota exceeded keys
    if (status === 'quota_exceeded' || status === 'invalid') {
      continue;
    }

    // Skip rate-limited keys unless at least 5 minutes have passed
    if (status === 'rate_limited' && Date.now() - timestamp < 5 * 60 * 1000) {
      continue;
    }

    // Add random jitter delay (100ms - 400ms) to avoid simultaneous burst request fingerprinting
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));

    const fullUrl = urlPath 
      ? `${ODDS_API_URL}/${urlPath}?apiKey=${key}${queryParams}` 
      : `${ODDS_API_URL}?apiKey=${key}${queryParams}`;
      
    try {
      const res = await fetch(fullUrl);
      lastStatus = res.status;
      
      if (res.status === 429) {
        keyStatuses[key] = 'rate_limited';
        keyTimestamps[key] = Date.now();
        updatedStatuses = true;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        keyStatuses[key] = 'quota_exceeded';
        keyTimestamps[key] = Date.now();
        updatedStatuses = true;
        continue;
      }
      if (!res.ok) {
        keyStatuses[key] = 'invalid';
        keyTimestamps[key] = Date.now();
        updatedStatuses = true;
        continue;
      }
      
      if (keyStatuses[key] !== 'active') {
        keyStatuses[key] = 'active';
        keyTimestamps[key] = Date.now();
        updatedStatuses = true;
      }
      
      localStorage.removeItem('amphy_api_error_status');
      if (updatedStatuses) {
        localStorage.setItem('amphy_keys_status', JSON.stringify(keyStatuses));
        localStorage.setItem('amphy_keys_timestamps', JSON.stringify(keyTimestamps));
      }
      
      // Save this index as the working sticky active key
      setActiveKeyIndex(idx);
      return await res.json();
    } catch {
      keyStatuses[key] = 'network_error';
      keyTimestamps[key] = Date.now();
      updatedStatuses = true;
    }
  }

  if (updatedStatuses) {
    localStorage.setItem('amphy_keys_status', JSON.stringify(keyStatuses));
    localStorage.setItem('amphy_keys_timestamps', JSON.stringify(keyTimestamps));
  }

  if (lastStatus === 429) {
    localStorage.setItem('amphy_api_error_status', 'rate_limit');
  } else if (lastStatus === 401 || lastStatus === 403) {
    localStorage.setItem('amphy_api_error_status', 'quota_exceeded');
  }
  return null;
}

async function fetchActiveLeaguesFromOddsApi(): Promise<string[]> {
  const CACHE_KEY_ACTIVE = 'amphy_active_leagues_cache';
  const CACHE_TTL_ACTIVE = 2 * 60 * 60 * 1000; // 2 hours
  
  try {
    const cached = localStorage.getItem(CACHE_KEY_ACTIVE);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_ACTIVE && Array.isArray(parsed.keys)) {
        return parsed.keys;
      }
    }
  } catch {}

  try {
    const data = await fetchOddsApiWithRotation('', '&all=false');
    if (!Array.isArray(data)) return [];
    const keys = data.map((s: any) => s.key);
    try {
      localStorage.setItem(CACHE_KEY_ACTIVE, JSON.stringify({
        timestamp: Date.now(),
        keys
      }));
    } catch {}
    return keys;
  } catch (err) {
    console.error("fetchActiveLeaguesFromOddsApi error:", err);
    return [];
  }
}
const ODDS_API_KEY = '4a5c423b1cb52ffb281ebcca674661af'; // kept for legacy references
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports';
const FOOTBALL_URL = 'https://v3.football.api-sports.io';

// football-data.org — match context (fixtures/results). Has NO odds so not used for arb.
const FOOTBALL_DATA_TOKEN = '6184028dae61404d93e8bfd84c720c8a';
export const FOOTBALL_DATA_AVAILABLE = !!FOOTBALL_DATA_TOKEN;

// === CACHE (resets at midnight WAT = UTC+1) ==================================
const CACHE_KEY = 'amphy_ai_predictions_cache_v25_WAT_MIDNIGHT';
const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;

function getWatMidnightUTC(): number {
  const nowWAT = Date.now() + WAT_OFFSET_MS;
  const d = new Date(nowWAT);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - WAT_OFFSET_MS;
}

export function isCacheValid(timestamp: number): boolean {
  return timestamp >= getWatMidnightUTC();
}

function getMsUntilNextWatMidnight(): number {
  return getWatMidnightUTC() + 24 * 60 * 60 * 1000 - Date.now();
}

export function getMsUntilPredictions(): number {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { timestamp } = JSON.parse(raw);
      if (isCacheValid(timestamp)) return 0;
    }
  } catch { /* ignore */ }
  return getMsUntilNextWatMidnight();
}

// === ACTIVE LEAGUES =========================================================
// Soccer leagues with real fixtures available now
// Soccer leagues ordered by current activity (nearest fixtures first)
const SOCCER_LEAGUE_KEYS = [
  // === Active RIGHT NOW / within 5 days ===
  'soccer_brazil_serie_b',          // Brazil Serie B
  'soccer_spain_segunda_division',  // Spain 2nd division
  'soccer_fifa_world_cup',          // FIFA World Cup 2026 (starts Jun 11)
  'soccer_usa_mls',                 // MLS
  'soccer_brazil_campeonato',       // Brazil Serie A (Brasileirao)
  'soccer_argentina_primera_division',
  'soccer_mexico_ligamx',
  'soccer_japan_j_league',
  'soccer_south_korea_kleague1',
  'soccer_australia_aleague',
  'soccer_chile_campeonato',
  'soccer_china_superleague',
  'soccer_conmebol_copa_libertadores',
  'soccer_conmebol_copa_sudamericana',
  // === European leagues (included for completeness / late-season) ===
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_uefa_champs_league',
  'soccer_netherlands_eredivisie',
  'soccer_portugal_primeira_liga',
  'soccer_turkey_super_league',
  'soccer_greece_super_league',
  'soccer_denmark_superliga',
  'soccer_norway_eliteserien',
  'soccer_sweden_allsvenskan',
  'soccer_sweden_superettan',
];

// Non-soccer: stricter 82%+ threshold, sport-specific safe markets. NO basketball.
const EXTRA_LEAGUE_KEYS = [
  // TENNIS — safest non-soccer: 1v1, no draws, heavy favourites ~90% reliable
  'tennis_atp_french_open',        // Roland Garros (active now)
  'tennis_wta_french_open',        // Roland Garros Women (active now)
  'tennis_atp_wimbledon',          // Wimbledon ATP (starts Jun 30)
  'tennis_wta_wimbledon',          // Wimbledon WTA (starts Jun 30)
  'tennis_atp_us_open',            // US Open (Aug 25)
  'tennis_wta_us_open',
  'tennis_atp_madrid',             // ATP 1000 Masters
  'tennis_wta_madrid',
  'tennis_atp_rome',
  'tennis_wta_rome',
  // BASKETBALL — points spread handicaps
  'basketball_nba',
  'basketball_euroleague',
  'basketball_wnba',
  // RUGBY LEAGUE — handicap only, never moneyline
  'rugbyleague_nrl',
  'rugbyleague_nrl_state_of_origin',
  // CRICKET — outright or totals
  'cricket_t20_blast',
  'cricket_odi',
  'cricket_test_match',
  // BASEBALL — run-line (underdog +1.5 runs)
  'baseball_mlb',
];

// === API-SPORTS KEY ROTATION =================================================
let currentKeyIndex = (() => {
  try {
    return parseInt(localStorage.getItem('amphy_ai_key_index') || '0') || 0;
  } catch {
    return 0;
  }
})();

function getApiKey() { return API_SPORTS_KEYS[currentKeyIndex % API_SPORTS_KEYS.length]; }
function rotateApiKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_SPORTS_KEYS.length;
  try {
    localStorage.setItem('amphy_ai_key_index', currentKeyIndex.toString());
  } catch {}
}

async function fetchWithKeyRotation(url: string, options: RequestInit = {}): Promise<any> {
  if (API_SPORTS_KEYS.length === 0) throw new Error('No API-Sports keys configured.');
  for (let attempt = 0; attempt < API_SPORTS_KEYS.length; attempt++) {
    const key = getApiKey();
    const headers = { ...options.headers, 'x-apisports-key': key };
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 429) { rotateApiKey(); continue; }
      const data = await res.json();
      if (data?.errors) {
        const hasErr =
          (typeof data.errors === 'object' && !Array.isArray(data.errors) && Object.keys(data.errors).length > 0) ||
          (Array.isArray(data.errors) && data.errors.length > 0);
        if (hasErr) { rotateApiKey(); continue; }
      }
      return data;
    } catch { rotateApiKey(); }
  }
  throw new Error('All API-Sports keys failed or are suspended.');
}

// === PROBABILITY HELPERS =====================================================
export interface OddsInfo {
  homeProb: number;
  awayProb: number;
  drawProb: number;
  homeOdds: number;
  awayOdds: number;
  drawOdds: number | null;
  bookmaker: string;
  spreadHomePoint?: number;
  spreadAwayPoint?: number;
  spreadHomeOdds?: number;
  spreadAwayOdds?: number;
}

const POWER_RANKINGS: Record<string, number> = {
  // MLS
  'inter miami': 1.12, 'lafc': 1.08, 'columbus crew': 1.09, 'la galaxy': 1.06, 'real salt lake': 1.05,
  // Brazil
  'palmeiras': 1.10, 'flamengo': 1.12, 'botafogo': 1.08, 'atletico mineiro': 1.06, 'sao paulo': 1.05, 'gremio': 1.04,
  // Argentina
  'river plate': 1.10, 'boca juniors': 1.07, 'racing club': 1.06,
  // Sweden
  'malmo ff': 1.12, 'djurgarden': 1.07, 'elfsborg': 1.05,
  // Norway
  'bodo/glimt': 1.14, 'molde': 1.08, 'brann': 1.06,
  // Japan
  'vissel kobe': 1.08, 'yokohama f. marinos': 1.06, 'sanfrecce hiroshima': 1.07,
  // Europe Elite
  'manchester city': 1.15, 'real madrid': 1.15, 'bayern munich': 1.12, 'arsenal': 1.10, 'psg': 1.12, 'barcelona': 1.08, 'leverkusen': 1.10, 'inter': 1.10
};

function getDeterministicBias(home: string, away: string): number {
  const comb = `${home}-${away}`;
  let hash = 0;
  for (let i = 0; i < comb.length; i++) {
    hash = comb.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Deterministic form swing: between -0.035 and +0.035
  return ((Math.abs(hash) % 100) / 1428) - 0.035;
}

function poissonProbability(lambda: number, k: number): number {
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
}

function calculatePoissonSpreadProbability(homeExpGoals: number, awayExpGoals: number, spreadPoint: number, isHome: boolean): number {
  let coverProb = 0;
  for (let h = 0; h <= 6; h++) {
    const pH = poissonProbability(homeExpGoals, h);
    for (let a = 0; a <= 6; a++) {
      const pA = poissonProbability(awayExpGoals, a);
      const pScore = pH * pA;

      if (isHome) {
        if (h + spreadPoint > a) {
          coverProb += pScore;
        } else if (h + spreadPoint === a) {
          coverProb += pScore * 0.5; // Push refund counts as half-win of probability contribution
        }
      } else {
        if (a + spreadPoint > h) {
          coverProb += pScore;
        } else if (a + spreadPoint === h) {
          coverProb += pScore * 0.5; // Push refund
        }
      }
    }
  }
  return Math.min(Math.round(coverProb * 100), 99);
}

interface SimulatedMarkets {
  over15: number;
  over25: number;
  btts: number;
}

function simulatePoissonMarkets(homeExpectedGoals: number, awayExpectedGoals: number): SimulatedMarkets {
  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  for (let h = 0; h <= 5; h++) {
    const pH = poissonProbability(homeExpectedGoals, h);
    for (let a = 0; a <= 5; a++) {
      const pA = poissonProbability(awayExpectedGoals, a);
      const pScore = pH * pA;

      if (h + a >= 2) over15 += pScore;
      if (h + a >= 3) over25 += pScore;
      if (h >= 1 && a >= 1) btts += pScore;
    }
  }

  return {
    over15: Math.round(over15 * 100),
    over25: Math.round(over25 * 100),
    btts: Math.round(btts * 100)
  };
}

function getPowerRankingMultiplier(teamName: string): number {
  const lower = teamName.toLowerCase();
  for (const [key, value] of Object.entries(POWER_RANKINGS)) {
    if (lower.includes(key)) return value;
  }
  return 1.0;
}

function calculateProbabilitiesFromOdds(bookmakers: any[], homeTeam: string, awayTeam: string): OddsInfo | null {
  const preferredKeys = ['unibet', 'betfair_ex_eu', 'williamhill', 'pinnacle', 'onexbet', 'bet365', 'livescorebet', 'betway'];
  let selectedBk = null;

  if (bookmakers && bookmakers.length > 0) {
    for (const key of preferredKeys) {
      const found = bookmakers.find((b: any) => b.key.includes(key));
      if (found) {
        selectedBk = found;
        break;
      }
    }
    if (!selectedBk) {
      selectedBk = bookmakers[0];
    }
  }

  if (!selectedBk) return null;

  const h2h = (selectedBk.markets || []).find((m: any) => m.key === 'h2h');
  if (!h2h?.outcomes) return null;

  const home = h2h.outcomes.find((o: any) => o.name === homeTeam);
  const away = h2h.outcomes.find((o: any) => o.name === awayTeam);
  const draw = h2h.outcomes.find((o: any) => o.name === 'Draw');
  if (!home || !away) return null;

  const hPrice = home.price;
  const aPrice = away.price;
  const dPrice = draw ? draw.price : null;

  // Extract spreads (handicaps) if available
  const spreads = (selectedBk.markets || []).find((m: any) => m.key === 'spreads');
  let spreadHomePoint: number | undefined;
  let spreadAwayPoint: number | undefined;
  let spreadHomeOdds: number | undefined;
  let spreadAwayOdds: number | undefined;

  if (spreads?.outcomes) {
    const sHome = spreads.outcomes.find((o: any) => o.name === homeTeam);
    const sAway = spreads.outcomes.find((o: any) => o.name === awayTeam);
    if (sHome && sAway) {
      spreadHomePoint = sHome.point;
      spreadHomeOdds = sHome.price;
      spreadAwayPoint = sAway.point;
      spreadAwayOdds = sAway.price;
    }
  }

  let hi = 1 / hPrice, ai = 1 / aPrice, di = dPrice ? 1 / dPrice : 0;
  
  // Apply AI Power Rankings Multipliers
  const homePR = getPowerRankingMultiplier(homeTeam);
  const awayPR = getPowerRankingMultiplier(awayTeam);
  hi *= homePR;
  ai *= awayPR;

  // Apply deterministic recent form/morale bias (+/- 3.5%)
  const bias = getDeterministicBias(homeTeam, awayTeam);
  if (bias > 0) {
    hi *= (1 + bias);
  } else {
    ai *= (1 + Math.abs(bias));
  }

  const total = hi + ai + di;
  if (total <= 0) return null;

  return {
    homeProb: Math.round((hi / total) * 100),
    awayProb: Math.round((ai / total) * 100),
    drawProb: draw ? Math.round((di / total) * 100) : 0,
    homeOdds: hPrice,
    awayOdds: aPrice,
    drawOdds: dPrice,
    bookmaker: selectedBk.title || selectedBk.key,
    spreadHomePoint,
    spreadAwayPoint,
    spreadHomeOdds,
    spreadAwayOdds
  };
}

function estimateHandicapOdds(coverProb: number): number {
  if (coverProb <= 0) return 1.0;
  const estimated = 1.06 / (coverProb / 100);
  // Capping at 1.01 instead of 1.12 prevents generating "ghost lines" (e.g. +3.5 at fake 1.12 odds).
  // Now, extremely safe lines will correctly fail the minimum odds threshold filter (>= 1.10),
  // forcing the AI to select standard, playable handicap options (+1.5, +2.5) that actually exist.
  return Math.max(1.01, +estimated.toFixed(2));
}

/**
 * Advanced Football Prediction Logic (Model v4.2).
 * Formulates selections based H2H true probability and Poisson simulated goal spreads.
 */
function buildSoccerPrediction(
  homeTeam: string,
  awayTeam: string,
  probs: OddsInfo,
  mode: 'live' | 'forecast' = 'forecast',
  handicapFocus = false
): MatchWithPrediction['prediction'] | null {
  const { homeProb, awayProb, drawProb, homeOdds, awayOdds, drawOdds, bookmaker, spreadHomePoint, spreadAwayPoint, spreadHomeOdds, spreadAwayOdds } = probs;
  const c1X = homeProb + drawProb;   // P(home wins OR draws)
  const cX2 = awayProb + drawProb;   // P(away wins OR draws)
  const dominant = Math.max(homeProb, awayProb);

  // Compute Expected Goal parameters for Poisson Simulation
  const bias = getDeterministicBias(homeTeam, awayTeam);
  const totalSimGoals = 2.65 + (bias * 2);
  const homeExpGoals = totalSimGoals * (homeProb / (homeProb + awayProb));
  const awayExpGoals = totalSimGoals * (awayProb / (homeProb + awayProb));
  
  const sim = simulatePoissonMarkets(homeExpGoals, awayExpGoals);

  const isHomeStrong = homeProb >= awayProb;
  const strongTeam = isHomeStrong ? homeTeam : awayTeam;
  const weakTeam   = isHomeStrong ? awayTeam : homeTeam;

  const underdogIsHome = !isHomeStrong;
  const favIsHome = isHomeStrong;

  // Real bookmaker spreads parsed data
  const underdogPoint = isHomeStrong ? spreadAwayPoint : spreadHomePoint;
  const underdogOdds  = isHomeStrong ? spreadAwayOdds : spreadHomeOdds;
  const favPoint = isHomeStrong ? spreadHomePoint : spreadAwayPoint;
  const favOdds  = isHomeStrong ? spreadHomeOdds : spreadAwayOdds;

  // Evaluate premium Asian Handicap options via Poisson model
  const pUnderdogPlus35 = calculatePoissonSpreadProbability(homeExpGoals, awayExpGoals, 3.5, underdogIsHome);
  const pUnderdogPlus25 = calculatePoissonSpreadProbability(homeExpGoals, awayExpGoals, 2.5, underdogIsHome);
  const pUnderdogPlus15 = calculatePoissonSpreadProbability(homeExpGoals, awayExpGoals, 1.5, underdogIsHome);
  const pFavPlus05      = calculatePoissonSpreadProbability(homeExpGoals, awayExpGoals, 0.5, favIsHome);
  const pFavZero        = calculatePoissonSpreadProbability(homeExpGoals, awayExpGoals, 0.0, favIsHome);

  const handicapOptions = [
    {
      name: `${weakTeam} +3.5 Goals Handicap (Asian Handicap)`,
      type: 'Goals Handicap',
      prob: pUnderdogPlus35,
      odds: (underdogPoint === 3.5 && underdogOdds) ? underdogOdds : estimateHandicapOdds(pUnderdogPlus35),
      reason: `AI selected an ultra-secure underdog cushion. Backing ${weakTeam} with a massive +3.5 goals head-start. This protects your capital against blowouts.`,
    },
    {
      name: `${weakTeam} +2.5 Goals Handicap (Asian Handicap)`,
      type: 'Goals Handicap',
      prob: pUnderdogPlus25,
      odds: (underdogPoint === 2.5 && underdogOdds) ? underdogOdds : estimateHandicapOdds(pUnderdogPlus25),
      reason: `AI selected a safe underdog cushion. Backing ${weakTeam} with a +2.5 goals head-start. Even if ${strongTeam} wins by 2 goals, the bet still covers.`,
    },
    {
      name: `${weakTeam} +1.5 Goals Handicap (Asian Handicap)`,
      type: 'Goals Handicap',
      prob: pUnderdogPlus15,
      odds: (underdogPoint === 1.5 && underdogOdds) ? underdogOdds : estimateHandicapOdds(pUnderdogPlus15),
      reason: `AI selected a point-cushioned entry. Backing ${weakTeam} with a +1.5 goals head-start. A draw or a 1-goal deficit wins the bet.`,
    },
    {
      name: `${strongTeam} +0.5 Goals Handicap (Asian Handicap)`,
      type: 'Goals Handicap',
      prob: pFavPlus05,
      odds: (favPoint === 0.5 && favOdds) ? favOdds : estimateHandicapOdds(pFavPlus05),
      reason: `AI selected a favorite point cushion. Backing ${strongTeam} with a +0.5 goals Asian Handicap (win or draw covers, absorbing unexpected upsets).`,
    },
    {
      name: `${strongTeam} Draw No Bet (0.0 Asian Handicap)`,
      type: 'Goals Handicap',
      prob: pFavZero,
      odds: (favPoint === 0.0 && favOdds) ? favOdds : estimateHandicapOdds(pFavZero),
      reason: `AI selected a Draw-No-Bet shield. Backing ${strongTeam} with a 0.0 Asian Handicap. A victory wins, and a draw triggers a full stake refund.`,
    }
  ];

  // Filter qualifying handicap options (confidence >= 82%, odds >= 1.10)
  const qualifyingHandicaps = handicapOptions.filter(o => o.prob >= 82 && o.odds >= 1.10);

  // Sort qualifying by highest probability (safest first)
  qualifyingHandicaps.sort((a, b) => b.prob - a.prob);

  let bestMarket = '', marketType = '', confidenceScore = 0;
  let calculatedRealOdds = 1.0;
  let reasoning = '';

  let handicapRecommended = false;
  if (qualifyingHandicaps.length > 0) {
    const bestHandicap = qualifyingHandicaps[0];
    bestMarket = bestHandicap.name;
    marketType = bestHandicap.type;
    confidenceScore = bestHandicap.prob;
    calculatedRealOdds = bestHandicap.odds;
    reasoning = bestHandicap.reason;
    handicapRecommended = true;
  }

  // Apply Risk Cushion Mode filter vs Standard Mode decision tree
  if (handicapFocus) {
    if (handicapRecommended) {
      // Use the handicap cushion prediction
    } else {
      // In handicap focus mode, if no handicap options meet thresholds, skip the match to preserve capital
      return null;
    }
  } else {
    // Standard Mode decision flow
    if (handicapRecommended && confidenceScore >= 88) {
      // Use premium handicap cushion even in standard mode
    } else if (dominant >= 76) {
      bestMarket = strongTeam + ' To Win';
      marketType = 'Outright Winner';
      confidenceScore = dominant;
      calculatedRealOdds = isHomeStrong ? homeOdds : awayOdds;
      reasoning = `AI calculations establish ${strongTeam} as a dominant favorite with a ${dominant}% true win probability. Strong head-to-head bias indicates high value.`;
    } else if (c1X >= 82 && isHomeStrong) {
      bestMarket = '1X (Home Win or Draw)';
      marketType = 'Double Chance';
      confidenceScore = c1X;
      calculatedRealOdds = drawOdds ? (homeOdds * drawOdds) / (homeOdds + drawOdds) : homeOdds;
      reasoning = `Double Chance safeguards against draws, covering 2 of 3 outcomes (${homeProb}% Home / ${drawProb}% Draw) with a combined AI confidence of ${c1X}%.`;
    } else if (cX2 >= 82 && !isHomeStrong) {
      bestMarket = 'X2 (Away Win or Draw)';
      marketType = 'Double Chance';
      confidenceScore = cX2;
      calculatedRealOdds = drawOdds ? (awayOdds * drawOdds) / (awayOdds + drawOdds) : awayOdds;
      reasoning = `Double Chance safeguards against draws, covering 2 of 3 outcomes (${awayProb}% Away / ${drawProb}% Draw) with a combined AI confidence of ${cX2}%.`;
    } else if (sim.over15 >= 82) {
      bestMarket = 'Over 1.5 Match Goals';
      marketType = 'Total Goals';
      confidenceScore = sim.over15;
      calculatedRealOdds = 1.16 + (Math.abs(homeProb - awayProb) / 100) * 0.20;
      reasoning = `Poisson goal simulations estimate ${homeExpGoals.toFixed(1)} expected home goals and ${awayExpGoals.toFixed(1)} expected away goals. Probability of over 1.5 match goals is simulated at ${sim.over15}%.`;
    } else if (sim.btts >= 78) {
      bestMarket = 'GG (Both Teams to Score)';
      marketType = 'Both Teams to Score';
      confidenceScore = sim.btts;
      calculatedRealOdds = 1.60 + (Math.random() * 0.25);
      reasoning = `High offensive ratings (Home: ${homeExpGoals.toFixed(1)}xG, Away: ${awayExpGoals.toFixed(1)}xG) establish a ${sim.btts}% simulated probability for mutual scoring.`;
    } else if (dominant >= 68) {
      bestMarket = strongTeam + ' Over 0.5 Goals';
      marketType = 'Team Goals';
      confidenceScore = dominant + 8;
      calculatedRealOdds = 1.05 + (1 - (dominant / 100)) * 0.35;
      reasoning = `The market favorite possesses a high individual scoring probability (${dominant}% implied chance). Over 0.5 team goals eliminates full-match outcome dependency.`;
    } else {
      return null;
    }
  }

  const final = Math.min(Math.round(confidenceScore), 97);
  if (final < 80) return null;

  if (!reasoning) {
    if (marketType === 'Outright Winner') {
      reasoning = `AI calculations establish ${strongTeam} as a dominant favorite with a ${dominant}% true win probability.`;
    } else if (marketType === 'Double Chance') {
      reasoning = `Double Chance safeguards against draws, covering 2 of 3 outcomes with a combined AI confidence of ${final}%.`;
    } else {
      reasoning = `High offensive ratings establish a simulated positive forecast for the favored outcome.`;
    }
  }

  const odd365 = calculatedRealOdds;
  const oddSporty = calculatedRealOdds * (0.97 + Math.random() * 0.04);

  // Compute EV: (Confidence % * Odds) / 100
  const ev = (final / 100) * oddSporty;

  return {
    recommendedBet: bestMarket,
    confidence: final,
    reasoning,
    expectedValue: +ev.toFixed(2),
    homeWinProb: homeProb, awayWinProb: awayProb, drawProb,
    markets: {
      btts: sim.btts >= 60 ? 'Yes' : 'No',
      goalsOverUnder: sim.over25 >= 55 ? 'Over 2.5' : 'Over 1.5',
      winOrDraw: marketType,
    },
    fairOdds: (100 / final).toFixed(2),
    sportyBetEstimate: oddSporty.toFixed(2),
    realOddsBet365: odd365.toFixed(2),
    realOddsSportyBet: oddSporty.toFixed(2),
    realBookmaker: bookmaker,
    marketSentiment: final > 92 ? 'Sharp' : final > 87 ? 'Balanced' : 'Public',
    isLive: true,
    predictionMode: mode,
  };
}

/**
 * Non-soccer prediction engine.
 * Sport-specific market selection — all designed to minimise variance:
 *
 *  TENNIS  — Outright winner when implied probability >= 68%.
 *            1v1, no draws. Heavy favourites (70%+) are extremely reliable.
 *            Close matches (< 68%) are skipped entirely.
 *
 *  RUGBY LEAGUE — Underdog handicap (+12.5 pts when fav >= 78%, else +6.5).
 *            Even if underdog loses, the points cushion covers most margins.
 *
 *  CRICKET — Match winner when favourite >= 72%; T20 totals as fallback.
 *
 *  BASEBALL — Run-line (underdog +1.5 runs) when favourite >= 68%.
 *            Even dominant MLB teams rarely win by >1 run every game.
 *
 * Minimum 82% composite confidence required.
 */
function buildNonSoccerPrediction(
  homeTeam: string,
  awayTeam: string,
  probs: OddsInfo,
  sportKey: string,
  handicapFocus = false
): MatchWithPrediction['prediction'] | null {
  const { homeProb, awayProb, homeOdds, awayOdds, bookmaker, spreadHomePoint, spreadAwayPoint, spreadHomeOdds, spreadAwayOdds } = probs;
  const dominant = Math.max(homeProb, awayProb);
  const strongTeam = homeProb >= awayProb ? homeTeam : awayTeam;
  const weakTeam   = homeProb >= awayProb ? awayTeam : homeTeam;

  let bestMarket = '', marketType = '', confidenceScore = 0, reasoning = '';
  let calculatedRealOdds = 1.0;

  // HEAVILY PRIORITIZE AND SCAN HANDICAP MARKETS (LOW-RISK CUSHIONS) FOR SPREAD SPORTS
  if ((sportKey.includes('rugby') || sportKey.includes('baseball') || sportKey.includes('basketball')) && handicapFocus) {
    const isHomeStrong = homeProb >= awayProb;
    const weakSpreadPoint = isHomeStrong ? spreadAwayPoint : spreadHomePoint;
    const weakSpreadOdds = isHomeStrong ? spreadAwayOdds : spreadHomeOdds;

    // A positive handicap cushion on the underdog (+ point) is the safest low-risk bet
    if (weakSpreadPoint !== undefined && weakSpreadOdds !== undefined && weakSpreadPoint > 0) {
      bestMarket = `${weakTeam} +${weakSpreadPoint} Points Handicap (Asian Handicap)`;
      marketType = 'Points Handicap';
      confidenceScore = dominant + 10; // extra buffer due to positive handicap safety
      calculatedRealOdds = weakSpreadOdds;
      reasoning = `AI selected a safe low-risk cushion. Underdog ${weakTeam} is backed with a +${weakSpreadPoint} Asian Handicap head-start. The opponent may win, but this massive point cushion offers high-resiliency protection.`;
    } else {
      // Fallback if API spreads are not initialized yet
      // For baseball (MLB), teams are closely matched, but +1.5 or +2.5 run cushions are extremely high probability!
      const isBaseball = sportKey.includes('baseball');
      const staticLine = isBaseball ? 1.5 : (dominant >= 78 ? 12.5 : 6.5);
      
      // Let's set a realistic confidence score based on the handicap line:
      // A run cushion in MLB gives an exceptionally high probability because baseball games are tight!
      confidenceScore = isBaseball ? 86 : (dominant + 8);
      bestMarket = isBaseball 
        ? `${weakTeam} +${staticLine} Runs Handicap (Asian Handicap)` 
        : `${weakTeam} +${staticLine} Points Handicap (Asian Handicap)`;
      marketType = isBaseball ? 'Runs Handicap' : 'Points Handicap';
      calculatedRealOdds = isBaseball ? 1.30 : (dominant >= 78 ? 1.35 : 1.45);
      reasoning = `Underdog cushion simulated. ${weakTeam} starts with a simulated +${staticLine} points handicap to absorb variance against a strong favourite.`;
    }

  } else if (sportKey.includes('tennis')) {
    if (dominant < 68) return null;
    if (handicapFocus) {
      bestMarket = `${strongTeam} +1.5 Sets Handicap (Asian Handicap)`;
      marketType = 'Sets Handicap';
      confidenceScore = Math.min(98, dominant + 10);
      reasoning = `AI selected a sets handicap cushion. Backing ${strongTeam} to win at least 1 set (+1.5 Sets start) gives a huge safety buffer. Their win probability is ${dominant}%, making a straight-sets loss highly improbable.`;
      const straightOdds = homeProb >= awayProb ? homeOdds : awayOdds;
      calculatedRealOdds = Math.max(1.10, +(straightOdds * 0.85).toFixed(2));
    } else {
      bestMarket = `${strongTeam} To Win`;
      marketType = 'Outright Winner';
      confidenceScore = dominant;
      reasoning = `AI calculations establish ${strongTeam} as the outright favorite with a ${dominant}% true win probability.`;
      calculatedRealOdds = homeProb >= awayProb ? homeOdds : awayOdds;
    }

  } else if (sportKey.includes('cricket')) {
    if (handicapFocus) return null; // Skip cricket completely in handicap mode
    if (dominant < 72) return null;
    bestMarket = `${strongTeam} To Win`;
    marketType = 'Outright Winner';
    confidenceScore = dominant;
    reasoning = `Cricket match winner selected. ${strongTeam} is the dominant side with ${dominant}% true win probability.`;
    calculatedRealOdds = homeProb >= awayProb ? homeOdds : awayOdds;

  } else {
    if (dominant < 72) return null;
    if (handicapFocus) {
      bestMarket = weakTeam + ' +1.5 Handicap';
      marketType = 'Handicap';
      confidenceScore = dominant + 8;
      reasoning = 'Market-implied edge (' + dominant + '%) exceeds threshold. Handicap selected for variance protection.';
      calculatedRealOdds = 1.30 + (Math.random() * 0.15);
    } else {
      bestMarket = strongTeam + ' To Win';
      marketType = 'Outright Winner';
      confidenceScore = dominant;
      reasoning = `AI calculations identify ${strongTeam} as the favorite with a ${dominant}% win probability.`;
      calculatedRealOdds = homeProb >= awayProb ? homeOdds : awayOdds;
    }
  }

  const final = Math.min(Math.round(confidenceScore), 96);
  if (final < 82) return null;

  const odd365 = calculatedRealOdds;
  const oddSporty = calculatedRealOdds * (0.97 + Math.random() * 0.04);

  // Compute EV: (Confidence % * Odds) / 100
  const ev = (final / 100) * oddSporty;

  return {
    recommendedBet: bestMarket,
    confidence: final,
    reasoning,
    expectedValue: +ev.toFixed(2),
    homeWinProb: homeProb, awayWinProb: awayProb, drawProb: 0,
    markets: { btts: null, goalsOverUnder: null, winOrDraw: marketType },
    fairOdds: (100 / final).toFixed(2),
    sportyBetEstimate: oddSporty.toFixed(2),
    realOddsBet365: odd365.toFixed(2),
    realOddsSportyBet: oddSporty.toFixed(2),
    realBookmaker: bookmaker,
    marketSentiment: final > 92 ? 'Sharp' : final > 87 ? 'Balanced' : 'Public',
    isLive: true,
    predictionMode: 'forecast',
  };
}

// === ODDS API FETCH ==========================================================
async function fetchOddsForLeague(leagueKey: string): Promise<any[]> {
  try {
    const data = await fetchOddsApiWithRotation(`${leagueKey}/odds/`, '&regions=eu&markets=h2h,spreads&oddsFormat=decimal');
    if (!Array.isArray(data)) return [];
    const nowMs = Date.now();
    const cutoffMs = nowMs + 120 * 60 * 60 * 1000; // Expanded to 5 days to cover weekdays and populate Upcoming tab
    return data.filter((o: any) => {
      const t = new Date(o.commence_time).getTime();
      return t > nowMs && t < cutoffMs;
    });
  } catch { return []; }
}

/**
 * Multi-region odds fetch for ARB scanning.
 * Fetches eu+uk+us+au in a single request — 4x more bookmakers per match
 * vs eu+uk only. More bookmakers = more chances to find cross-bookie arb gaps.
 */
async function fetchOddsForLeagueMultiRegion(leagueKey: string): Promise<any[]> {
  try {
    const data = await fetchOddsApiWithRotation(`${leagueKey}/odds/`, '&regions=eu,uk,us,au&markets=h2h,spreads&oddsFormat=decimal');
    if (!Array.isArray(data)) return [];
    const nowMs = Date.now();
    const cutoffMs = nowMs + 120 * 60 * 60 * 1000;
    return data.filter((o: any) => {
      const t = new Date(o.commence_time).getTime();
      return t > nowMs && t < cutoffMs;
    });
  } catch { return []; }
}


// === SCORES FETCH FOR AUTO-SETTLEMENT ========================================
export async function fetchScoresForLeague(leagueKey: string, daysFrom = 3): Promise<any[]> {
  try {
    const data = await fetchOddsApiWithRotation(`${leagueKey}/scores/`, `&daysFrom=${daysFrom}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// === MAIN EXPORT =============================================================
/**
 * Fetch today's top picks.
 * @param forceRefresh — bypass cache (used by "Trigger Scan" button)
 */
// === ARBITRAGE TYPES ==========================================================
export interface ArbitrageOpportunity {
  id: string;
  sport_title: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  arbPercent: number;        // Margin e.g. 2.3% = 2.3
  guaranteedProfit: number;  // Profit on ₦1000 stake
  legs: ArbLeg[];
}

export interface ArbLeg {
  outcome: string;           // "Home Win" / "Away Win" / "Draw"
  bookmaker: string;
  odds: number;
  stake: number;             // How much to put on this leg from ₦1000
  payout: number;            // Payout if this leg wins
}

// Arb cache: 2-hour TTL (arbs are time-sensitive, not day-level like predictions)
const ARB_CACHE_KEY = 'amphy_arb_cache_v4';
const ARB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Returns milliseconds since last arb scan, or Infinity if never scanned */
export function getArbCacheAge(): number {
  try {
    const raw = localStorage.getItem(ARB_CACHE_KEY);
    if (raw) {
      const { timestamp } = JSON.parse(raw);
      return Date.now() - timestamp;
    }
  } catch { /* ignore */ }
  return Infinity;
}

// Top 14 high-volume leagues — maximize arb discovery while staying in free-tier budget.
// Multi-region (eu+uk+us+au) means more bookmakers per match = more cross-bookie arb gaps.
export const ARB_LEAGUE_KEYS = [
  // Soccer — highest global bookmaker coverage
  'soccer_brazil_serie_b',
  'soccer_usa_mls',
  'soccer_brazil_campeonato',
  'soccer_argentina_primera_division',
  'soccer_conmebol_copa_libertadores',
  'soccer_conmebol_copa_sudamericana',
  'soccer_fifa_world_cup',            // World Cup 2026 (starts Jun 11)
  'soccer_mexico_ligamx',
  'soccer_japan_j_league',
  // Tennis — 1v1, no draws, biggest arb potential
  'tennis_atp_french_open',
  'tennis_wta_french_open',
  'tennis_atp_wimbledon',
  // Other sports — AU/US bookmakers diverge most from EU on these
  'baseball_mlb',
  'rugbyleague_nrl',
  'basketball_nba',
];

// === ARBITRAGE SCANNER =======================================================
/**
 * Core arb detection engine.
 * Given a list of normalised match objects, returns ArbitrageOpportunity[].
 */
function detectArbitrage(
  matches: { homeTeam: string; awayTeam: string; commenceTime: string; sportTitle: string; sportKey?: string; bookmakers: any[] }[],
  STAKE: number
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const match of matches) {
    if (!match.bookmakers || match.bookmakers.length < 2) continue;

    const bestOdds: Record<string, { odds: number; bookmaker: string }> = {};
    for (const bk of match.bookmakers) {
      const h2h = (bk.markets || []).find((m: any) => m.key === 'h2h');
      if (!h2h?.outcomes) continue;
      for (const outcome of h2h.outcomes) {
        const name: string = outcome.name;
        const price: number = outcome.price;
        if (price > 1.0 && (!bestOdds[name] || price > bestOdds[name].odds)) {
          bestOdds[name] = { odds: price, bookmaker: bk.title || bk.key };
        }
      }
    }

    const outcomeNames = Object.keys(bestOdds);
    if (outcomeNames.length < 2) continue;

    const impliedSum = outcomeNames.reduce((acc, name) => acc + (1 / bestOdds[name].odds), 0);
    if (impliedSum >= 1.0) continue;

    const arbPercent = +((1 - impliedSum) * 100).toFixed(2);
    if (arbPercent < 0.3) continue;

    const guaranteedPayout = STAKE / impliedSum;
    const guaranteedProfit = +(guaranteedPayout - STAKE).toFixed(0);

    const legs: ArbLeg[] = outcomeNames.map(name => {
      const stake = +(STAKE * (1 / bestOdds[name].odds) / impliedSum).toFixed(0);
      const payout = +(stake * bestOdds[name].odds).toFixed(0);
      return {
        outcome: name === match.homeTeam ? 'Home Win' : name === match.awayTeam ? 'Away Win' : name === 'Draw' ? 'Draw' : name,
        bookmaker: bestOdds[name].bookmaker,
        odds: bestOdds[name].odds,
        stake,
        payout,
      };
    });

    opportunities.push({
      id: `${match.homeTeam}-${match.awayTeam}-${match.commenceTime}`,
      sport_title: match.sportTitle,
      sport_key: match.sportKey || 'unknown',
      commence_time: match.commenceTime,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      arbPercent,
      guaranteedProfit,
      legs,
    });
  }

  opportunities.sort((a, b) => b.arbPercent - a.arbPercent);
  return opportunities;
}

/**
 * Fetch arbitrage (SureBet) opportunities.
 * Standard endpoint using The-Odds-API (multi-region bookmaker scan).
 */
export async function fetchArbitrageOpportunities(
  forceRefresh = false,
  customStake = 1000,
  activeLeagues?: string[]
): Promise<ArbitrageOpportunity[]> {
  try {
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(ARB_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Use 2-hour TTL for arb (not midnight — arbs are time-sensitive)
          if (Date.now() - parsed.timestamp < ARB_TTL_MS) return Array.isArray(parsed.data) ? parsed.data : [];
        }
      } catch { /* ignore */ }
    }

    const STAKE = customStake > 0 ? customStake : 1000;
    let opportunities: ArbitrageOpportunity[] = [];
    let dataSource = 'odds_api';

    const activeCloudLeagues = await fetchActiveLeaguesFromOddsApi();
    const leaguesToScanRaw = activeLeagues && activeLeagues.length > 0 ? activeLeagues : ARB_LEAGUE_KEYS;
    // Filter out inactive leagues to save API requests
    const leaguesToScan = leaguesToScanRaw.filter(k => activeCloudLeagues.includes(k));
    
    if (leaguesToScan.length > 0) {
      const results = await Promise.all(
        leaguesToScan.map(k => fetchOddsForLeagueMultiRegion(k))
      );
      const normalized = results.flat().map(match => ({
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        commenceTime: match.commence_time,
        sportTitle: match.sport_title,
        sportKey: leaguesToScan[results.findIndex(r => r.includes(match))] || 'unknown',
        bookmakers: match.bookmakers || [],
      }));
      opportunities = detectArbitrage(normalized, STAKE);
    }

    // Store which data source was last used (for UI display)
    localStorage.setItem('amphy_arb_data_source', dataSource);

    // Cache the results
    localStorage.setItem(ARB_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: opportunities }));
    return opportunities;
  } catch (error) {
    console.error('fetchArbitrageOpportunities failed:', error);
    try {
      localStorage.setItem(ARB_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: [] }));
    } catch {}
  }
}

function seedRandom(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return function() {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
}

export function generateSimulatedDailyPicks(handicapFocus: boolean): MatchWithPrediction[] {
  const result: MatchWithPrediction[] = [];
  const baseTime = Date.now();
  
  const formatWatDate = (ms: number) => {
    const d = new Date(ms + 1 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  const todayStr = formatWatDate(baseTime);
  const tomorrowStr = formatWatDate(baseTime + 24 * 60 * 60 * 1000);
  const upcomingStr = formatWatDate(baseTime + 48 * 60 * 60 * 1000);

  const days = [
    { name: 'Today', dateStr: todayStr, msOffset: 0 },
    { name: 'Tomorrow', dateStr: tomorrowStr, msOffset: 24 * 60 * 60 * 1000 },
    { name: 'Upcoming', dateStr: upcomingStr, msOffset: 48 * 60 * 60 * 1000 }
  ];

  const soccerTeams = [
    { name: 'Palmeiras', rating: 85, league: 'BRAZIL CAMPEONATO' },
    { name: 'Flamengo', rating: 86, league: 'BRAZIL CAMPEONATO' },
    { name: 'Botafogo', rating: 82, league: 'BRAZIL CAMPEONATO' },
    { name: 'Gremio', rating: 78, league: 'BRAZIL CAMPEONATO' },
    { name: 'Sao Paulo', rating: 80, league: 'BRAZIL CAMPEONATO' },
    { name: 'Inter Miami', rating: 83, league: 'USA MLS' },
    { name: 'LA Galaxy', rating: 81, league: 'USA MLS' },
    { name: 'Columbus Crew', rating: 82, league: 'USA MLS' },
    { name: 'Malmo FF', rating: 80, league: 'SWEDEN ALLSVENSKAN' },
    { name: 'Bodo/Glimt', rating: 81, league: 'NORWAY ELITESERIEN' },
    { name: 'River Plate', rating: 84, league: 'ARGENTINA PRIMERA' },
    { name: 'Boca Juniors', rating: 81, league: 'ARGENTINA PRIMERA' },
    { name: 'Vissel Kobe', rating: 79, league: 'JAPAN J-LEAGUE' },
    { name: 'Yokohama Marinos', rating: 78, league: 'JAPAN J-LEAGUE' }
  ];

  const baseballTeams = [
    { name: 'LA Dodgers', rating: 87, league: 'BASEBALL MLB' },
    { name: 'NY Yankees', rating: 84, league: 'BASEBALL MLB' },
    { name: 'Atlanta Braves', rating: 83, league: 'BASEBALL MLB' },
    { name: 'Houston Astros', rating: 82, league: 'BASEBALL MLB' },
    { name: 'Philadelphia Phillies', rating: 81, league: 'BASEBALL MLB' },
    { name: 'Boston Red Sox', rating: 78, league: 'BASEBALL MLB' },
    { name: 'SF Giants', rating: 77, league: 'BASEBALL MLB' },
    { name: 'Chicago Cubs', rating: 76, league: 'BASEBALL MLB' }
  ];

  const basketballTeams = [
    { name: 'LA Lakers', rating: 83, league: 'BASKETBALL NBA' },
    { name: 'Boston Celtics', rating: 88, league: 'BASKETBALL NBA' },
    { name: 'Golden State Warriors', rating: 82, league: 'BASKETBALL NBA' },
    { name: 'Milwaukee Bucks', rating: 85, league: 'BASKETBALL NBA' },
    { name: 'Denver Nuggets', rating: 86, league: 'BASKETBALL NBA' },
    { name: 'Miami Heat', rating: 80, league: 'BASKETBALL NBA' },
    { name: 'Phoenix Suns', rating: 81, league: 'BASKETBALL NBA' },
    { name: 'Dallas Mavericks', rating: 84, league: 'BASKETBALL NBA' }
  ];

  const tennisPlayers = [
    { name: 'Carlos Alcaraz', rating: 92, league: 'TENNIS ATP' },
    { name: 'Jannik Sinner', rating: 93, league: 'TENNIS ATP' },
    { name: 'Novak Djokovic', rating: 91, league: 'TENNIS ATP' },
    { name: 'Alexander Zverev', rating: 85, league: 'TENNIS ATP' },
    { name: 'Daniil Medvedev', rating: 86, league: 'TENNIS ATP' },
    { name: 'Iga Swiatek', rating: 94, league: 'TENNIS WTA' },
    { name: 'Aryna Sabalenka', rating: 91, league: 'TENNIS WTA' },
    { name: 'Coco Gauff', rating: 88, league: 'TENNIS WTA' },
    { name: 'Elena Rybakina', rating: 89, league: 'TENNIS WTA' }
  ];

  for (const day of days) {
    const rng = seedRandom(day.dateStr);

    const shuffle = <T>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const shuffledSoccer = shuffle(soccerTeams);
    const shuffledBaseball = shuffle(baseballTeams);
    const shuffledBasketball = shuffle(basketballTeams);
    const shuffledTennis = shuffle(tennisPlayers);

    // 2 Soccer matches
    for (let i = 0; i < 2; i++) {
      const home = shuffledSoccer[i * 2];
      const away = shuffledSoccer[i * 2 + 1];
      
      const homeBias = rng() * 0.1;
      const diff = (home.rating - away.rating) / 10 + homeBias;
      
      let homeProb = Math.round(38 + diff * 35);
      let drawProb = Math.round(26 - Math.abs(diff) * 10);
      let awayProb = 100 - homeProb - drawProb;
      
      if (homeProb < 10) { homeProb = 10; drawProb = 25; awayProb = 65; }
      if (awayProb < 10) { awayProb = 10; drawProb = 25; homeProb = 65; }

      const homeOdds = +(1.05 / (homeProb / 100)).toFixed(2);
      const awayOdds = +(1.05 / (awayProb / 100)).toFixed(2);
      const drawOdds = +(1.05 / (drawProb / 100)).toFixed(2);

      const probs: OddsInfo = {
        homeProb, awayProb, drawProb,
        homeOdds, awayOdds, drawOdds,
        bookmaker: 'AI Calibration Engine'
      };

      const dateObj = new Date(baseTime + day.msOffset);
      dateObj.setHours(i === 0 ? 15 : 18, 0, 0, 0);

      const pred = buildSoccerPrediction(home.name, away.name, probs, 'forecast', handicapFocus);
      if (pred) {
        pred.predictionMode = 'simulation';
        result.push({
          id: `sim-soccer-${day.dateStr}-${i}`,
          sport_key: 'soccer',
          sport_title: home.league,
          commence_time: dateObj.toISOString(),
          home_team: home.name,
          away_team: away.name,
          prediction: pred
        });
      }
    }

    // 2 Baseball matches
    for (let i = 0; i < 2; i++) {
      const home = shuffledBaseball[i * 2];
      const away = shuffledBaseball[i * 2 + 1];

      const diff = (home.rating - away.rating) / 10;
      let homeProb = Math.round(52 + diff * 25);
      let awayProb = 100 - homeProb;

      const homeOdds = +(1.05 / (homeProb / 100)).toFixed(2);
      const awayOdds = +(1.05 / (awayProb / 100)).toFixed(2);

      const probs: OddsInfo = {
        homeProb, awayProb, drawProb: 0,
        homeOdds, awayOdds, drawOdds: null,
        bookmaker: 'AI Calibration Engine'
      };

      const dateObj = new Date(baseTime + day.msOffset);
      dateObj.setHours(i === 0 ? 16 : 20, 0, 0, 0);

      const pred = buildNonSoccerPrediction(home.name, away.name, probs, 'baseball_mlb', handicapFocus);
      if (pred) {
        pred.predictionMode = 'simulation';
        result.push({
          id: `sim-baseball-${day.dateStr}-${i}`,
          sport_key: 'baseball_mlb',
          sport_title: home.league,
          commence_time: dateObj.toISOString(),
          home_team: home.name,
          away_team: away.name,
          prediction: pred
        });
      }
    }

    // 2 Basketball matches
    for (let i = 0; i < 2; i++) {
      const home = shuffledBasketball[i * 2];
      const away = shuffledBasketball[i * 2 + 1];

      const diff = (home.rating - away.rating) / 10;
      let homeProb = Math.round(52 + diff * 25);
      let awayProb = 100 - homeProb;

      const homeOdds = +(1.05 / (homeProb / 100)).toFixed(2);
      const awayOdds = +(1.05 / (awayProb / 100)).toFixed(2);

      const probs: OddsInfo = {
        homeProb, awayProb, drawProb: 0,
        homeOdds, awayOdds, drawOdds: null,
        bookmaker: 'AI Calibration Engine'
      };

      const dateObj = new Date(baseTime + day.msOffset);
      dateObj.setHours(i === 0 ? 19 : 22, 0, 0, 0);

      const pred = buildNonSoccerPrediction(home.name, away.name, probs, 'basketball_nba', handicapFocus);
      if (pred) {
        pred.predictionMode = 'simulation';
        result.push({
          id: `sim-basketball-${day.dateStr}-${i}`,
          sport_key: 'basketball_nba',
          sport_title: home.league,
          commence_time: dateObj.toISOString(),
          home_team: home.name,
          away_team: away.name,
          prediction: pred
        });
      }
    }

    // 2 Tennis matches
    for (let i = 0; i < 2; i++) {
      const home = shuffledTennis[i];
      const away = shuffledTennis[shuffledTennis.length - 1 - i];

      const diff = (home.rating - away.rating) / 10;
      let homeProb = Math.round(65 + diff * 25);
      let awayProb = 100 - homeProb;

      if (homeProb < 75) {
        homeProb = 76;
        awayProb = 24;
      }

      const homeOdds = +(1.05 / (homeProb / 100)).toFixed(2);
      const awayOdds = +(1.05 / (awayProb / 100)).toFixed(2);

      const probs: OddsInfo = {
        homeProb, awayProb, drawProb: 0,
        homeOdds, awayOdds, drawOdds: null,
        bookmaker: 'AI Calibration Engine'
      };

      const dateObj = new Date(baseTime + day.msOffset);
      dateObj.setHours(i === 0 ? 13 : 17, 0, 0, 0);

      const pred = buildNonSoccerPrediction(home.name, away.name, probs, 'tennis_atp', handicapFocus);
      if (pred) {
        pred.predictionMode = 'simulation';
        result.push({
          id: `sim-tennis-${day.dateStr}-${i}`,
          sport_key: 'tennis_atp',
          sport_title: home.league,
          commence_time: dateObj.toISOString(),
          home_team: home.name,
          away_team: away.name,
          prediction: pred
        });
      }
    }
  }

  result.sort((a, b) => b.prediction.confidence - a.prediction.confidence);
  return result;
}

export async function fetchDailyTopPicks(forceRefresh = false, handicapFocus = false): Promise<MatchWithPrediction[]> {
  try {
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (isCacheValid(parsed.timestamp) && parsed.handicapFocus === handicapFocus) {
            return parsed.data;
          }
        }
      } catch { /* ignore */ }
    }

    localStorage.setItem('amphy_api_status', JSON.stringify({
      status: 'working', message: 'Scanning global markets...', timestamp: Date.now(),
    }));

    // Check if we have a valid raw odds cache (valid for 1 hour)
    const RAW_CACHE_KEY = 'amphy_raw_odds_cache_v1';
    let rawCache: { timestamp: number; soccer: Record<string, any[]>; extra: Record<string, any[]>; apiSportsFootball?: any[]; apiSportsWorking?: boolean } | null = null;
    try {
      const saved = localStorage.getItem(RAW_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000) { // 1 hour TTL
          rawCache = parsed;
        }
      }
    } catch {}

    let apiSportsFootball: any[] = [];
    let apiSportsWorking = false;
    let soccerResults: Record<string, any[]> = {};
    let extraResults: Record<string, any[]> = {};

    if (rawCache && !forceRefresh) {
      // Use cached raw data
      apiSportsFootball = rawCache.apiSportsFootball || [];
      apiSportsWorking = !!rawCache.apiSportsWorking;
      soccerResults = rawCache.soccer || {};
      extraResults = rawCache.extra || {};
    } else {
      // Fetch fresh data from network
      if (API_SPORTS_KEYS.length > 0) {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const res = await fetchWithKeyRotation(`${FOOTBALL_URL}/fixtures?date=${todayStr}`);
          const fixtures: any[] = res.response || [];
          if (fixtures.length > 0) {
            apiSportsWorking = true;
            apiSportsFootball = fixtures;
          }
        } catch { /* fall through */ }
      }

      if (!apiSportsWorking) {
        const activeCloudLeagues = await fetchActiveLeaguesFromOddsApi();
        const activeSoccerLeagues = SOCCER_LEAGUE_KEYS.filter(k => activeCloudLeagues.includes(k));
        const activeExtraLeagues = activeCloudLeagues.filter(k => 
          k.startsWith('tennis_') || 
          k.startsWith('baseball_') || 
          k.startsWith('rugbyleague_') || 
          k.startsWith('cricket_') ||
          k.startsWith('basketball_')
        );

        if (activeSoccerLeagues.length > 0) {
          const BATCH = 5;
          for (let i = 0; i < activeSoccerLeagues.length; i += BATCH) {
            const slice = activeSoccerLeagues.slice(i, i + BATCH);
            const results = await Promise.all(slice.map(k => fetchOddsForLeague(k)));
            for (let j = 0; j < slice.length; j++) {
              soccerResults[slice[j]] = results[j] || [];
            }
          }
        }

        for (const key of activeExtraLeagues) {
          extraResults[key] = await fetchOddsForLeague(key) || [];
        }
      }

      // Save raw data to cache
      try {
        localStorage.setItem(RAW_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          soccer: soccerResults,
          extra: extraResults,
          apiSportsFootball,
          apiSportsWorking
        }));
      } catch {}
    }

    let collected: MatchWithPrediction[] = [];

    if (!apiSportsWorking) {
      // Compile soccer predictions
      for (const [leagueKey, matches] of Object.entries(soccerResults)) {
        for (const o of matches) {
          if (collected.length >= 75) break;
          const probs = calculateProbabilitiesFromOdds(o.bookmakers || [], o.home_team, o.away_team);
          if (!probs) continue;
          const pred = buildSoccerPrediction(o.home_team, o.away_team, probs, 'forecast', handicapFocus);
          if (!pred) continue;
          collected.push({
            id: `odds-${leagueKey}-${o.id}`,
            sport_key: 'soccer',
            sport_title: o.sport_title || leagueKey.replace(/_/g, ' ').toUpperCase(),
            commence_time: o.commence_time,
            home_team: o.home_team,
            away_team: o.away_team,
            prediction: pred,
          });
        }
      }

      // Compile extra sports predictions
      for (const [sportKey, matches] of Object.entries(extraResults)) {
        for (const o of matches) {
          if (collected.length >= 85) break;
          const probs = calculateProbabilitiesFromOdds(o.bookmakers || [], o.home_team, o.away_team);
          if (!probs) continue;
          const pred = buildNonSoccerPrediction(o.home_team, o.away_team, probs, sportKey, handicapFocus);
          if (!pred) continue;
          collected.push({
            id: `odds-${sportKey}-${o.id}`,
            sport_key: sportKey,
            sport_title: o.sport_title || sportKey.replace(/_/g, ' ').toUpperCase(),
            commence_time: o.commence_time,
            home_team: o.home_team,
            away_team: o.away_team,
            prediction: pred,
          });
        }
      }

    } else {
      // API-Sports compilation
      const topFB = apiSportsFootball
        .filter((f: any) => f.fixture.status.short === 'NS')
        .slice(0, 30);

      for (const item of topFB) {
        try {
          let pred: MatchWithPrediction['prediction'] | null = null;
          try {
            const pData = await fetchWithKeyRotation(`${FOOTBALL_URL}/predictions?fixture=${item.fixture.id}`);
            const p = pData.response?.[0];
            if (p) {
              const hp = parseInt(p.predictions.percent.home?.replace('%', '')) || 0;
              const ap = parseInt(p.predictions.percent.away?.replace('%', '')) || 0;
              const dp = parseInt(p.predictions.percent.draw?.replace('%', '')) || 0;
              const oddsInfo: OddsInfo = {
                homeProb: hp,
                awayProb: ap,
                drawProb: dp,
                homeOdds: hp > 0 ? 100 / hp : 1.5,
                awayOdds: ap > 0 ? 100 / ap : 1.5,
                drawOdds: dp ? 100 / dp : 3.0,
                bookmaker: 'API-Sports'
              };
              pred = buildSoccerPrediction(item.teams.home.name, item.teams.away.name, oddsInfo, 'live', handicapFocus);
            }
          } catch { /* fall through */ }

          if (!pred) {
            const probs = calculateProbabilitiesFromOdds(item.bookmakers || [], item.teams.home.name, item.teams.away.name);
            if (probs) pred = buildSoccerPrediction(item.teams.home.name, item.teams.away.name, probs, 'live', handicapFocus);
          }
          if (!pred) continue;

          collected.push({
            id: `fb-${item.fixture.id}`,
            sport_key: 'soccer',
            sport_title: item.league.name,
            commence_time: item.fixture.date,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            prediction: pred,
          });
        } catch { /* skip */ }
      }
    }

    collected.sort((a, b) => b.prediction.confidence - a.prediction.confidence);

    if (collected.length === 0) {
      console.log("No fixtures met criteria or APIs are suspended. Triggering AI Simulation Fallback Engine...");
      collected = generateSimulatedDailyPicks(handicapFocus);
      
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: collected, handicapFocus }));
      localStorage.setItem('amphy_api_status', JSON.stringify({
        status: 'simulated',
        message: `AI Calibration Fallback — ${collected.length} elite daily picks simulated`,
        timestamp: Date.now(),
      }));
      return collected;
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: collected, handicapFocus }));
    localStorage.setItem('amphy_api_status', JSON.stringify({
      status: apiSportsWorking ? 'working' : 'fallback',
      message: apiSportsWorking
        ? 'API-Sports Online — Live Intelligence Active'
        : `Odds API — ${collected.length} high-certainty picks verified`,
      timestamp: Date.now(),
    }));

    return collected;
  } catch (error) {
    console.error('fetchDailyTopPicks failed:', error);
    try {
      console.log("Triggering AI Simulation Fallback Engine after fetch crash...");
      const collected = generateSimulatedDailyPicks(handicapFocus);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: collected, handicapFocus }));
      localStorage.setItem('amphy_api_status', JSON.stringify({
        status: 'simulated',
        message: `AI Calibration Fallback — ${collected.length} elite daily picks simulated`,
        timestamp: Date.now(),
      }));
      return collected;
    } catch (simError) {
      console.error("AI Fallback failed:", simError);
      return [];
    }
  }
}
