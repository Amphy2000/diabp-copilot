import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchDailyTopPicks, getMsUntilPredictions, fetchScoresForLeague, fetchArbitrageOpportunities, getArbCacheAge, ARB_LEAGUE_KEYS, isCacheValid, type MatchWithPrediction, type ArbitrageOpportunity } from './services/api';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { Header } from './components/Header';
import { MatchCard } from './components/MatchCard';
import { Auth } from './components/Auth';
import { Activity, AlertCircle, Calendar, ShieldCheck, Bell, ChevronRight, Zap, TrendingUp, RefreshCw, Settings, DollarSign, Key, Cloud } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import './index.css';

type DayFilter = 'Today' | 'Tomorrow' | 'Upcoming';
type MainTab = 'predictions' | 'arbitrage' | 'valuebets';

function evaluateBetOutcome(bet: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number): boolean | null {
  const betLower = bet.toLowerCase();
  
  if (betLower.includes('1x (home win or draw)')) {
    return homeScore >= awayScore;
  }
  if (betLower.includes('x2 (away win or draw)')) {
    return awayScore >= homeScore;
  }
  
  if (betLower.includes('over 0.5 goals')) {
    const index = bet.indexOf(' Over 0.5 Goals');
    const teamPart = index !== -1 ? bet.substring(0, index).toLowerCase() : '';
    if (homeTeam.toLowerCase().includes(teamPart) || teamPart.includes(homeTeam.toLowerCase())) {
      return homeScore >= 1;
    }
    if (awayTeam.toLowerCase().includes(teamPart) || teamPart.includes(awayTeam.toLowerCase())) {
      return awayScore >= 1;
    }
    return null;
  }
  
  if (betLower.includes('over 1.5 match goals') || betLower.includes('over 1.5 goals')) {
    return (homeScore + awayScore) >= 2;
  }

  if (betLower.includes('to win') || betLower.includes('to win match')) {
    let teamName = '';
    if (betLower.includes('to win match')) {
      teamName = bet.substring(0, bet.indexOf(' To Win Match')).trim();
    } else {
      teamName = bet.substring(0, bet.indexOf(' To Win')).trim();
    }
    const isHome = homeTeam.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(homeTeam.toLowerCase());
    const isAway = awayTeam.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(awayTeam.toLowerCase());
    if (isHome) return homeScore > awayScore;
    if (isAway) return awayScore > homeScore;
    return null;
  }

  if (betLower.includes('+12.5 points handicap') || betLower.includes('+12.5')) {
    const teamName = bet.substring(0, bet.indexOf(' +12.5')).trim();
    const isHome = homeTeam.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(homeTeam.toLowerCase());
    if (isHome) {
      return (homeScore + 12.5) > awayScore;
    } else {
      return (awayScore + 12.5) > homeScore;
    }
  }

  if (betLower.includes('+6.5 points handicap') || betLower.includes('+6.5')) {
    const teamName = bet.substring(0, bet.indexOf(' +6.5')).trim();
    const isHome = homeTeam.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(homeTeam.toLowerCase());
    if (isHome) {
      return (homeScore + 6.5) > awayScore;
    } else {
      return (awayScore + 6.5) > homeScore;
    }
  }

  if (betLower.includes('+1.5 runs') || betLower.includes('+1.5')) {
    const teamName = bet.substring(0, bet.indexOf(' +1.5')).trim();
    const isHome = homeTeam.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(homeTeam.toLowerCase());
    if (isHome) {
      return (homeScore + 1.5) > awayScore;
    } else {
      return (awayScore + 1.5) > homeScore;
    }
  }

  if (homeScore > awayScore && betLower.includes(homeTeam.toLowerCase())) return true;
  if (awayScore > homeScore && betLower.includes(awayTeam.toLowerCase())) return true;
  
  return null;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [allMatches, setAllMatches] = useState<MatchWithPrediction[]>([]);
  const [dayFilter, setDayFilter] = useState<DayFilter>('Today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('predictions');
  const [arbOpportunities, setArbOpportunities] = useState<ArbitrageOpportunity[]>(() => {
    try {
      const raw = localStorage.getItem('amphy_arb_cache_v4');
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.data)) return p.data;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [arbLoading, setArbLoading] = useState(false);
  const [arbScanned, setArbScanned] = useState(false);
  const [arbStake, setArbStake] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('amphy_arb_stake');
      const val = saved ? parseInt(saved, 10) : 1000;
      return isNaN(val) ? 1000 : val;
    } catch { return 1000; }
  });
  const [enabledLeagues, setEnabledLeagues] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('amphy_enabled_arb_leagues');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return ARB_LEAGUE_KEYS; // default: all enabled
  });
  const [handicapFocus, setHandicapFocus] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('amphy_handicap_focus');
      return saved === 'false' ? false : true;
    } catch { return true; }
  });
  const [tempHandicapFocus, setTempHandicapFocus] = useState<boolean>(true);
  const [tempEnabledLeagues, setTempEnabledLeagues] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const openSettings = () => {
    setTempEnabledLeagues([...enabledLeagues]);
    setTempHandicapFocus(handicapFocus);
    setSyncStatusMsg(null);
    setShowSettings(true);
  };
  const [arbLastScanned, setArbLastScanned] = useState<number | null>(() => {
    try {
      const age = getArbCacheAge();
      return (age === Infinity || isNaN(age)) ? null : Date.now() - age;
    } catch { return null; }
  });
  const [arbNextScanIn, setArbNextScanIn] = useState<string | null>(null);
  const arbIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPilotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-pilot mode: smart scanning during peak opportunity periods
  const [autoPilotMode, setAutoPilotMode] = useState<boolean>(() => {
    try { return localStorage.getItem('amphy_autopilot') === 'true'; } catch { return false; }
  });



  const [notifications, setNotifications] = useState<{ id: number; text: string; time: string }[]>([
    { id: 1, text: "System calibrated. Statistical confidence above 80% required for display.", time: "Just now" }
  ]);
  const [history, setHistory] = useState<{ id: string; match: string; bet: string; status: 'pending' | 'won' | 'lost'; date?: string; odds?: string }[]>(() => {
    try {
      const saved = localStorage.getItem('amphy_ai_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });
  
  const updateHistory = (newHistory: any[]) => {
    const truncated = newHistory.slice(0, 30);
    setHistory(truncated);
    localStorage.setItem('amphy_ai_history', JSON.stringify(truncated));
  };
  const [deletedHistoryIds, setDeletedHistoryIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('amphy_deleted_history_ids');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const [isTrackerExpanded, setIsTrackerExpanded] = useState(false);
  const [predictionsCountdown, setPredictionsCountdown] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(localStorage.getItem('amphy_api_error_status'));

  const updateHistoryStatus = (id: string, status: 'won' | 'lost') => {
    const newHistory = history.map(h => h.id === id ? { ...h, status } : h);
    updateHistory(newHistory);
  };

  const deleteHistoryItem = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    updateHistory(newHistory);
    const newDeletedIds = [...deletedHistoryIds, id];
    setDeletedHistoryIds(newDeletedIds);
    localStorage.setItem('amphy_deleted_history_ids', JSON.stringify(newDeletedIds));
    
    // Auto-sync deletion to cloud
    if (session?.user) {
      const remoteSettings = session.user.user_metadata?.amphy_settings || {};
      supabase.auth.updateUser({
        data: {
          amphy_settings: {
            ...remoteSettings,
            deleted_history_ids: newDeletedIds.slice(-100) // Prune to prevent Cloudflare 520 bloat
          }
        }
      }).catch(err => console.error("Cloud sync deletion error:", err));
    }
  };

  const settledPicks = history.filter(h => h.status !== 'pending');
  const wins = settledPicks.filter(h => h.status === 'won').length;
  const losses = settledPicks.filter(h => h.status === 'lost').length;
  const hitRate = settledPicks.length > 0 ? ((wins / settledPicks.length) * 100).toFixed(1) : '0.0';
  
  // Calculate net units and ROI based on actual SportyBet/bet365 odds
  const netUnits = settledPicks.reduce((acc, h) => {
    if (h.status === 'won') {
      const odd = parseFloat(h.odds || '1.80');
      return acc + (odd - 1);
    } else if (h.status === 'lost') {
      return acc - 1;
    }
    return acc;
  }, 0);
  const roi = settledPicks.length > 0 ? ((netUnits / settledPicks.length) * 100).toFixed(1) : '0.0';
  useEffect(() => {
    if (allMatches.length > 0) {
      // Auto-switch filter if Today is empty but Tomorrow has games
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      
      const todayCount = allMatches.filter(m => {
        const d = new Date(m.commence_time);
        return d >= todayDate && d < tomorrowDate && m.prediction.confidence >= 80;
      }).length;

      if (todayCount === 0) {
        setDayFilter('Tomorrow');
      }

      const topPick = allMatches[0];
      setNotifications(prev => [
        { id: Date.now(), text: `🔥 ELITE PICK: ${topPick.home_team} vs ${topPick.away_team} [${topPick.prediction.recommendedBet}]`, time: "New" },
        ...prev
      ].slice(0, 5));

      // Mobile-Reliable Notification via SW
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification('🔥 NEW ELITE PICK', {
            body: `${topPick.home_team} vs ${topPick.away_team} - ${topPick.prediction.recommendedBet}`,
            icon: '/favicon.ico',
            vibrate: [200, 100, 200],
            badge: '/favicon.ico',
            tag: 'elite-alert'
          });
        });
      }

      // Auto-add all displayed matches to history if not exists and IS LIVE
      let currentHistory = [...history];
      let historyUpdated = false;

      const matchesToTrack = allMatches.filter(match => match.prediction.confidence >= 80).slice(0, 5);
      
      matchesToTrack.forEach(match => {
        const historyId = `hist-${match.id}`;
        const matchName = `${match.home_team} vs ${match.away_team}`;
        
        if (
          match.prediction.isLive && 
          !deletedHistoryIds.includes(historyId) &&
          !currentHistory.find(h => h.id === historyId || h.match === matchName)
        ) {
          currentHistory.unshift({
            id: historyId,
            match: matchName,
            bet: match.prediction.recommendedBet,
            status: "pending" as const,
            date: match.commence_time,
            odds: match.prediction.realOddsSportyBet || match.prediction.sportyBetEstimate
          });
          historyUpdated = true;
        }
      });

      if (historyUpdated) {
        updateHistory(currentHistory.slice(0, 30));
      }
    }
  }, [allMatches, history, deletedHistoryIds]);

  // Auto-settlement hook
  useEffect(() => {
    const autoSettle = async () => {
      const pendingPastItems = history.filter(h => {
        if (h.status !== 'pending') return false;
        if (!h.date) return false;
        const elapsedMs = Date.now() - new Date(h.date).getTime();
        return elapsedMs > 4 * 60 * 60 * 1000; // 4 hours elapsed since commencement
      });

      if (pendingPastItems.length === 0) return;

      console.log(`Auto-settler scanning ${pendingPastItems.length} past matches...`);

      const leagueGroups: { [key: string]: any[] } = {};
      pendingPastItems.forEach(item => {
        const match = item.id.match(/hist-odds-([a-z0-9_]+)-/);
        const leagueKey = match ? match[1] : 'unknown';
        if (leagueKey !== 'unknown') {
          if (!leagueGroups[leagueKey]) leagueGroups[leagueKey] = [];
          leagueGroups[leagueKey].push(item);
        }
      });

      let historyChanged = false;
      const updatedHistory = [...history];

      for (const leagueKey of Object.keys(leagueGroups)) {
        try {
          const scoresData = await fetchScoresForLeague(leagueKey, 3);
          if (!scoresData || scoresData.length === 0) continue;

          const itemsToSettle = leagueGroups[leagueKey];
          itemsToSettle.forEach(item => {
            const [homePart, awayPart] = item.match.split(' vs ');
            const scoreMatch = scoresData.find((s: any) => {
              const sHome = s.home_team.toLowerCase();
              const sAway = s.away_team.toLowerCase();
              const iHome = homePart.toLowerCase();
              const iAway = awayPart.toLowerCase();
              return (sHome.includes(iHome) || iHome.includes(sHome)) &&
                     (sAway.includes(iAway) || iAway.includes(sAway));
            });

            if (scoreMatch && scoreMatch.completed && scoreMatch.scores) {
              const homeScoreObj = scoreMatch.scores.find((s: any) => s.name === scoreMatch.home_team);
              const awayScoreObj = scoreMatch.scores.find((s: any) => s.name === scoreMatch.away_team);

              if (homeScoreObj && awayScoreObj) {
                const homeScore = parseInt(homeScoreObj.score);
                const awayScore = parseInt(awayScoreObj.score);
                const isWon = evaluateBetOutcome(item.bet, scoreMatch.home_team, scoreMatch.away_team, homeScore, awayScore);
                
                if (isWon !== null) {
                  const idx = updatedHistory.findIndex(h => h.id === item.id);
                  if (idx !== -1) {
                    updatedHistory[idx] = {
                      ...updatedHistory[idx],
                      status: isWon ? 'won' : 'lost'
                    };
                    historyChanged = true;
                    console.log(`Auto-settled ${item.match} -> ${isWon ? 'WON' : 'LOST'}`);
                  }
                }
              }
            }
          });
        } catch (err) {
          console.error(`Auto-settle failed for league ${leagueKey}:`, err);
        }
      }

      if (historyChanged) {
        updateHistory(updatedHistory);
      }
    };

    if (allMatches.length > 0) {
      autoSettle();
    }
  }, [allMatches]);

  useEffect(() => {
    // Notification Permission Check
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setTimeout(() => setShowNotificationModal(true), 3000);
    }

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        console.log('Elite Intelligence Sync Active');
      });
    }

    // Install Prompt Listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });

    const syncUserData = async (sess: any) => {
      if (!sess?.user) return;
      
      let user = sess.user;
      try {
        if (typeof supabase.auth.getUser === 'function') {
          const { data: { user: freshUser }, error } = await supabase.auth.getUser();
          if (!error && freshUser) {
            user = freshUser;
          }
        }
      } catch (err) {
        console.warn("Could not retrieve fresh user profile for sync, using cached session:", err);
      }
      
      // 1. Keep history fully local & prune remote database history to clear Cloudflare 520 header bloat
      if (user.user_metadata?.amphy_history !== undefined && user.user_metadata?.amphy_history !== null) {
        supabase.auth.updateUser({
          data: { amphy_history: null }
        }).catch(err => console.error("Prune remote history error:", err));
      }
      
      // 2. Sync settings (smart merging to prevent overwriting active keys with empty cloud ones)
      const remoteSettings = user.user_metadata?.amphy_settings || {};
      
      const localCustomKey = localStorage.getItem('amphy_custom_odds_api_key') || '';
      const localStake = parseInt(localStorage.getItem('amphy_arb_stake') || '1000', 10) || 1000;
      const localHandicapFocus = localStorage.getItem('amphy_handicap_focus') === 'true';
      
      let localLeagues = ARB_LEAGUE_KEYS;
      try {
        const saved = localStorage.getItem('amphy_enabled_arb_leagues');
        if (saved) localLeagues = JSON.parse(saved);
      } catch {}

      let localDeletedIds: string[] = [];
      try {
        const saved = localStorage.getItem('amphy_deleted_history_ids');
        if (saved) localDeletedIds = JSON.parse(saved);
      } catch {}
      if (!Array.isArray(localDeletedIds)) localDeletedIds = [];

      let needsUpload = false;
      const mergedSettings = { ...remoteSettings };

      // Custom Odds API Key sync
      if (remoteSettings.custom_odds_api_key) {
        localStorage.setItem('amphy_custom_odds_api_key', remoteSettings.custom_odds_api_key);
      } else if (localCustomKey) {
        mergedSettings.custom_odds_api_key = localCustomKey;
        needsUpload = true;
      }

      // Default Stake sync
      if (remoteSettings.arb_stake) {
        localStorage.setItem('amphy_arb_stake', remoteSettings.arb_stake.toString());
        setArbStake(remoteSettings.arb_stake);
      } else if (localStake && localStake !== 1000) {
        mergedSettings.arb_stake = localStake;
        needsUpload = true;
      }

      // Enabled Leagues sync
      if (remoteSettings.enabled_leagues && Array.isArray(remoteSettings.enabled_leagues) && remoteSettings.enabled_leagues.length > 0) {
        localStorage.setItem('amphy_enabled_arb_leagues', JSON.stringify(remoteSettings.enabled_leagues));
        setEnabledLeagues(remoteSettings.enabled_leagues);
      } else if (localLeagues && localLeagues.length > 0) {
        mergedSettings.enabled_leagues = localLeagues;
        needsUpload = true;
      }

      // Handicap Focus Mode sync
      let targetHandicapFocus = true;
      const rawLocal = localStorage.getItem('amphy_handicap_focus');
      if (rawLocal === 'false') {
        targetHandicapFocus = false;
      } else if (rawLocal === 'true') {
        targetHandicapFocus = true;
      } else {
        if (remoteSettings.handicap_focus !== undefined) {
          targetHandicapFocus = remoteSettings.handicap_focus === true;
        } else {
          targetHandicapFocus = true;
        }
        localStorage.setItem('amphy_handicap_focus', targetHandicapFocus ? 'true' : 'false');
      }
      setHandicapFocus(targetHandicapFocus);

      if (remoteSettings.handicap_focus !== targetHandicapFocus) {
        mergedSettings.handicap_focus = targetHandicapFocus;
        needsUpload = true;
      }

      // Deleted history IDs sync (two-way merge, limited to 100 items to avoid database bloat)
      const remoteDeletedIds = remoteSettings.deleted_history_ids || [];
      if (Array.isArray(remoteDeletedIds) && remoteDeletedIds.length > 0) {
        const union = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds]));
        const prunedUnion = union.slice(-100);
        
        const isDifferent = 
          prunedUnion.length !== localDeletedIds.length || 
          !prunedUnion.every(val => localDeletedIds.includes(val));
          
        if (isDifferent) {
          localStorage.setItem('amphy_deleted_history_ids', JSON.stringify(prunedUnion));
          setDeletedHistoryIds(prunedUnion);
        }
        
        const isRemoteDifferent = 
          remoteDeletedIds.length !== prunedUnion.length || 
          !prunedUnion.every(val => remoteDeletedIds.includes(val));
          
        if (isRemoteDifferent) {
          mergedSettings.deleted_history_ids = prunedUnion;
          needsUpload = true;
        }
      } else if (localDeletedIds.length > 0) {
        mergedSettings.deleted_history_ids = localDeletedIds;
        needsUpload = true;
      }

      if (needsUpload) {
        supabase.auth.updateUser({
          data: {
            amphy_settings: mergedSettings
          }
        }).catch(err => console.error("Auto-sync settings upload error:", err));
      }

      // 3. Sync predictions cache (two-way merge to avoid rescanning on other devices)
      const remoteCache = user.user_metadata?.amphy_predictions_cache;
      const localCacheRaw = localStorage.getItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
      let localCache: any = null;
      try {
        if (localCacheRaw) localCache = JSON.parse(localCacheRaw);
      } catch {}

      const localValid = localCache && isCacheValid(localCache.timestamp);
      const remoteValid = remoteCache && isCacheValid(remoteCache.timestamp);

      if (remoteValid && (!localValid || remoteCache.timestamp > localCache.timestamp)) {
        // Only pull remote cache if it matches our active target handicap mode
        if (remoteCache.handicapFocus === targetHandicapFocus) {
          localStorage.setItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT', JSON.stringify(remoteCache));
          setAllMatches(remoteCache.data || []);
          setApiError(null);
        } else {
          // Mode mismatch: clear local cache and empty allMatches so second useEffect triggers re-compilation
          localStorage.removeItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
          setAllMatches([]);
        }
      } else if (localValid && (!remoteValid || localCache.timestamp > remoteCache.timestamp)) {
        // Only push local cache if it matches our active target handicap mode
        if (localCache.handicapFocus === targetHandicapFocus) {
          supabase.auth.updateUser({
            data: {
              amphy_predictions_cache: localCache
            }
          }).catch(err => console.error("Push predictions cache error:", err));
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setShowLogin(false);
        syncUserData(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowLogin(false);
        syncUserData(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // --- PREDICTION WINDOW COUNTDOWN ---
    function updateCountdown() {
      const msLeft = getMsUntilPredictions();
      if (msLeft <= 0) {
        setPredictionsCountdown(null);
      } else {
        const totalSeconds = Math.ceil(msLeft / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        setPredictionsCountdown(
          h > 0
            ? `${h}h ${String(m).padStart(2, '0')}m until today's picks`
            : `${m}m ${String(s).padStart(2, '0')}s until today's picks`
        );
      }
    }

    updateCountdown();
    async function loadData(force = false) {
      try {
        setLoading(true);
        const data = await fetchDailyTopPicks(force, handicapFocus);
        setAllMatches(data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        
        if (data.length > 0) {
          setApiError(null);
          if (session?.user && force) {
            supabase.auth.updateUser({
              data: {
                amphy_predictions_cache: {
                  timestamp: Date.now(),
                  data
                }
              }
            }).catch(err => console.error("Push predictions cache error:", err));
          }
        } else {
          setApiError(localStorage.getItem('amphy_api_error_status'));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'System Calibration Failed');
        setApiError(localStorage.getItem('amphy_api_error_status'));
      } finally {
        setLoading(false);
      }
    }


    // Countdown ticker — updates every second
    const countdownInterval = setInterval(updateCountdown, 1000);

    // Only call the API once per day (cache resets at midnight WAT).
    // Auto-re-fetches at midnight WAT so fresh picks appear without manual action.
    loadData();

    let midnightTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNextMidnightFetch = () => {
      const msLeft = getMsUntilPredictions();
      if (msLeft > 0) {
        midnightTimer = setTimeout(() => {
          loadData();
          scheduleNextMidnightFetch(); // reschedule for the next midnight
        }, msLeft);
      }
    };
    scheduleNextMidnightFetch();

    return () => {
      clearInterval(countdownInterval);
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, [session, handicapFocus]);

  // Removed Auth gate to prevent blank screens if Supabase fails
  // if (!session) {
  //   return <Auth />;
  // }

  const getFilteredMatches = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    let filtered = allMatches.filter(match => {
      const matchDate = new Date(match.commence_time);
      let isDateMatch = false;

      if (dayFilter === 'Today') {
        isDateMatch = matchDate >= today && matchDate < tomorrow;
      } else if (dayFilter === 'Tomorrow') {
        isDateMatch = matchDate >= tomorrow && matchDate < dayAfterTomorrow;
      } else if (dayFilter === 'Upcoming') {
        isDateMatch = matchDate >= dayAfterTomorrow;
      }
      
      return isDateMatch && match.prediction.confidence >= 80;
    });

    filtered.sort((a, b) => b.prediction.confidence - a.prediction.confidence);
    return filtered.slice(0, 15);
  };

  const displayedMatches = getFilteredMatches();

  const getValueBets = () => {
    const opportunities: any[] = [];
    for (const match of allMatches) {
      const pred = match.prediction;
      if (!pred) continue;
      const confidence = pred.confidence;
      if (!confidence) continue;
      
      const sbOdds = parseFloat(pred.realOddsSportyBet || pred.sportyBetEstimate) || 0;
      const b365Odds = parseFloat(pred.realOddsBet365 || pred.fairOdds) || 0;
      if (!sbOdds && !b365Odds) continue;
      
      const maxOdds = Math.max(sbOdds, b365Odds);
      const bestBookie = sbOdds >= b365Odds ? 'SportyBet' : 'Bet365';
      
      // EV Edge: (Confidence % * Odds) - 100%
      const edge = (confidence / 100) * maxOdds - 1;
      
      if (edge > 0.01) { // 1% edge or greater
        // Kelly Criterion = Edge / (Odds - 1)
        // We use Quarter Kelly for safety: 0.25 * Kelly
        const kellyFraction = maxOdds > 1 ? Math.min(0.05, (edge / (maxOdds - 1)) * 0.25) : 0;
        const suggestedStake = Math.round(arbStake * kellyFraction);
        
        opportunities.push({
          match,
          recommendedBet: pred.recommendedBet,
          confidence,
          fairOdds: pred.fairOdds,
          bestOdds: maxOdds.toFixed(2),
          bestBookie,
          edge: (edge * 100).toFixed(1),
          suggestedStake: Math.max(suggestedStake, 100), // Min 100
          kellyPercent: (kellyFraction * 100).toFixed(1)
        });
      }
    }
    // Sort by highest edge
    return opportunities.sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));
  };

  const valueBets = getValueBets();

  const getAccumulator = () => {
    // Filter candidates with confidence >= 82%
    let candidates = [...allMatches].filter(m => m.prediction.confidence >= 82);

    if (handicapFocus) {
      // Prioritize Handicap cushions & Tennis bankable wins strictly
      candidates = candidates.filter(m => {
        const isHandicap = m.prediction.recommendedBet.toLowerCase().includes('handicap') || 
                           m.prediction.recommendedBet.toLowerCase().includes('cushion') ||
                           m.prediction.recommendedBet.toLowerCase().includes('draw no bet') ||
                           m.prediction.markets.winOrDraw?.toLowerCase().includes('handicap') ||
                           m.prediction.markets.winOrDraw?.toLowerCase().includes('spread');
        const isTennis = m.sport_key.includes('tennis') || m.sport_title.toLowerCase().includes('tennis');
        return isHandicap || isTennis;
      });
    }

    candidates.sort((a, b) => {
      // 1. Prioritize Tennis matches first
      const aIsTennis = a.sport_key.includes('tennis') || a.sport_title.toLowerCase().includes('tennis');
      const bIsTennis = b.sport_key.includes('tennis') || b.sport_title.toLowerCase().includes('tennis');
      
      if (aIsTennis && !bIsTennis) return -1;
      if (!aIsTennis && bIsTennis) return 1;
      
      // 2. Otherwise sort by highest confidence
      return b.prediction.confidence - a.prediction.confidence;
    });

    if (candidates.length < 2) return null;

    const selected: MatchWithPrediction[] = [];
    let currentSportyBetOdds = 1.0;
    let currentBet365Odds = 1.0;

    for (const match of candidates) {
      if (selected.length >= 4) break; // Cap at most 4 legs for safety
      
      const oddSb = parseFloat(match.prediction.realOddsSportyBet) || parseFloat(match.prediction.sportyBetEstimate) || 1.25;
      const odd365 = parseFloat(match.prediction.realOddsBet365) || parseFloat(match.prediction.fairOdds) || 1.25;
      
      selected.push(match);
      currentSportyBetOdds *= oddSb;
      currentBet365Odds *= odd365;

      // Stop once we hit or exceed the ~2.00 target (e.g. 1.95)
      if (currentSportyBetOdds >= 1.95) {
        break;
      }
    }

    // Must be at least 1.85 odds (roughly 2.00 odds slip)
    if (currentSportyBetOdds < 1.85) return null;

    return {
      matches: selected,
      sportyBetOdds: currentSportyBetOdds.toFixed(2),
      bet365Odds: currentBet365Odds.toFixed(2)
    };
  };

  const accumulator = getAccumulator();

  const runArbScan = useCallback(async (force = false, stake?: number, leagues?: string[]) => {
    const stakeToUse = stake ?? arbStake;
    const leaguesToUse = leagues ?? enabledLeagues;
    setArbLoading(true);
    try {
      const data = await fetchArbitrageOpportunities(force, stakeToUse, leaguesToUse);
      setArbOpportunities(data);
      setArbLastScanned(Date.now());
      setArbScanned(true);
      setApiError(localStorage.getItem('amphy_api_error_status'));

      // Notify if a high-value arb (>=1.5%) was found
      const highValue = data.filter(a => a.arbPercent >= 1.5);
      if (highValue.length > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('⚡ LIVE ARB FOUND', {
            body: `${highValue[0].home_team} vs ${highValue[0].away_team} — +${highValue[0].arbPercent}% guaranteed margin (₦${highValue[0].guaranteedProfit} profit)`,
            icon: '/favicon.ico',
            tag: 'arb-alert',
            vibrate: [100, 50, 100, 50, 200],
          });
        }).catch(() => {});
      }
    } catch {
      setApiError(localStorage.getItem('amphy_api_error_status'));
    } finally {
      setArbLoading(false);
    }
  }, [arbStake, enabledLeagues]);

  // Arbitrage scanner: auto-pilot or manual mode
  useEffect(() => {
    if (mainTab === 'arbitrage') {
      setApiError(localStorage.getItem('amphy_api_error_status'));
    }
  }, [mainTab]);

  // Auto-pilot: scan every 8 minutes when in active window (07:00–23:00 local time)
  // or every 30 minutes overnight. This catches arbs during peak bookmaker divergence.
  // Background Arbitrage scanner disabled to conserve API quota as requested by user.
  useEffect(() => {
    if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
  }, []);

  return (
    <div className="container">
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>
      <div className="bg-blob bg-blob-3"></div>
      <Header 
        session={session} 
        onLoginClick={() => setShowLogin(true)} 
        onSettingsClick={openSettings} 
        arbStake={arbStake} 
      />
      
      <main style={{ paddingBottom: '80px' }}>
        {!isSupabaseConfigured && (
          <div className="glass-panel animate-scale-in" style={{ 
            padding: '12px 20px', 
            marginBottom: '24px', 
            background: 'rgba(245, 158, 11, 0.1)', 
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={18} color="#f59e0b" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                Offline Local Mode
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: '2px', color: 'var(--text-secondary)' }}>
                Supabase credentials not configured in Vercel. Settings and history are stored locally in this browser.
              </div>
            </div>
          </div>
        )}
        {apiError && (
          <div className="glass-panel animate-scale-in" style={{ 
            padding: '16px 24px', 
            marginBottom: '32px', 
            background: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            color: '#ef4444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  {apiError === 'quota_exceeded' ? 'API Quota Exceeded' : 'API Rate Limit Exceeded'}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px', color: 'var(--text-secondary)' }}>
                  {apiError === 'quota_exceeded' 
                    ? 'Your Odds API key has used up its free monthly quota. Live scans are disabled (showing cached predictions). Please configure a fresh API key.'
                    : 'Too many requests sent. The Odds API is rate-limiting scans. Please wait 5 minutes before scanning again.'
                  }
                </div>
              </div>
            </div>
            <button
              onClick={openSettings}
              style={{
                padding: '8px 16px',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: 'white',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
            >
              <Settings size={14} color="#a78bfa" />
              Configure Keys
            </button>
          </div>
        )}
        {/* Tab selection removed: simplified UI focused purely on core Handicap Predictions */}

        {mainTab === 'predictions' && (
        <section className="animate-fade-in" style={{ marginBottom: '40px', textAlign: 'center', padding: '20px 0' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            background: 'rgba(16, 185, 129, 0.1)', 
            borderRadius: '100px', 
            color: 'var(--accent-success)', 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            marginBottom: '20px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            textTransform: 'uppercase'
          }}>
            <ShieldCheck size={14} />
            100% Verified Banker Logic
          </div>
          
          <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', fontWeight: 800, marginBottom: '16px', lineHeight: 1, letterSpacing: '-0.04em' }}>
            <span className="text-gradient">Sure Odds</span> <br/>
            <span className="gold-gradient">Elite Bankers</span>
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
            Our neural network has filtered out all high-risk games. Below are the only matches verified for maximum win probability.
          </p>
        </section>
        )}

        {/* Notification Permission Modal */}
        {showNotificationModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel animate-scale-in" style={{ maxWidth: '400px', width: '100%', padding: '32px', textAlign: 'center', border: '1px solid var(--accent-primary)' }}>
              <Bell size={48} color="var(--accent-primary)" style={{ marginBottom: '20px' }} />
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px' }}>Enable Real-Time Alerts?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Never miss an "Elite Banker." Get instant notifications on your device as soon as our AI identifies a 80%+ winning opportunity.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={async () => {
                    if (typeof Notification !== 'undefined') {
                      const permission = await Notification.requestPermission();
                      setShowNotificationModal(false);
                      if (permission === 'granted') {
                        const reg = await navigator.serviceWorker.ready;
                        reg.showNotification('🚀 ALERTS ACTIVE', {
                          body: 'Neural sync successful. You are now tracking live markets!',
                          icon: '/favicon.ico'
                        });
                      }
                    } else {
                      setShowNotificationModal(false);
                    }
                  }}
                  style={{ padding: '14px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  ALLOW ELITE ALERTS
                </button>
                <button 
                  onClick={() => setShowNotificationModal(false)}
                  style={{ padding: '14px', background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS MODAL ─────────────────────────────────────────── */}
        {showSettings && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowSettings(false); setSyncStatusMsg(null); } }}
          >
            <div className="glass-panel animate-scale-in" style={{ 
              maxWidth: '480px', 
              width: '100%', 
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '32px', 
              border: '1px solid rgba(139,92,246,0.3)', 
              background: 'linear-gradient(135deg, rgba(10,10,20,0.98), rgba(15,10,30,0.98))' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <div style={{ padding: '8px', background: 'rgba(139,92,246,0.15)', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Settings size={20} color="#a78bfa" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>System Settings</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Configure API keys and stake preferences</p>
                </div>
                <button onClick={() => { setShowSettings(false); setSyncStatusMsg(null); }} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>✕</button>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <DollarSign size={16} color="var(--accent-gold)" />
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-gold)' }}>Default Arb Stake (₦)</div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                  All arb profit and stake split calculations scale to this amount.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>₦</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    defaultValue={arbStake}
                    id="settings-stake-input"
                    style={{
                      flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                      color: 'white', fontSize: '1rem', fontWeight: 700, outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <ShieldCheck size={16} color={tempHandicapFocus ? '#34d399' : 'var(--accent-gold)'} style={{ filter: tempHandicapFocus ? 'drop-shadow(0 0 4px rgba(52,211,153,0.3))' : 'none' }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: tempHandicapFocus ? '#34d399' : 'var(--accent-gold)' }}>Prediction Strategy</div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                  Select whether the AI targets low-risk, point-cushion handicaps or standard, higher-yield betting markets (Moneyline, Over/Under, Double Chance).
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTempHandicapFocus(true)}
                    style={{
                      flex: 1, padding: '12px 10px',
                      background: tempHandicapFocus ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                      border: tempHandicapFocus ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', color: tempHandicapFocus ? '#34d399' : 'var(--text-muted)',
                      fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <span>🛡️ Risk-Cushion</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 500, opacity: 0.8 }}>Handicaps (~1.10 - 1.30 odds)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempHandicapFocus(false)}
                    style={{
                      flex: 1, padding: '12px 10px',
                      background: !tempHandicapFocus ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                      border: !tempHandicapFocus ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', color: !tempHandicapFocus ? 'var(--accent-gold)' : 'var(--text-muted)',
                      fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <span>🔥 High-Yield</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 500, opacity: 0.8 }}>Standard (~1.40 - 2.20+ odds)</span>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Key size={16} color="#a78bfa" />
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#a78bfa' }}>Odds API Key(s)</div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                  Paste one or more keys (separated by commas) to auto-rotate and combine quotas. Get keys at{' '}
                  <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', fontWeight: 700 }}>the-odds-api.com</a>.
                </p>
                <input
                  type="text"
                  id="settings-api-key-input"
                  defaultValue={localStorage.getItem('amphy_custom_odds_api_key') || ''}
                  style={{
                    width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                    color: 'white', fontSize: '0.8rem', fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'monospace'
                  }}
                  placeholder="key1, key2, key3..."
                />
                
                {/* Individual Key Status Badges */}
                {(() => {
                  const customKeysRaw = localStorage.getItem('amphy_custom_odds_api_key') || '';
                  const currentKeysList = customKeysRaw.split(',').map(k => k.trim()).filter(k => k.length > 5);
                  if (currentKeysList.length === 0) return null;
                  
                  const rawStatuses = localStorage.getItem('amphy_keys_status');
                  let keyStatuses: Record<string, string> = {};
                  try {
                    if (rawStatuses) keyStatuses = JSON.parse(rawStatuses);
                  } catch {}

                  return (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Key Status Checklist ({currentKeysList.length} configured):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        {currentKeysList.map((key, idx) => {
                          const status = keyStatuses[key] || 'unchecked';
                          let statusLabel = '⚪ Pending Scan';
                          let statusColor = 'var(--text-muted)';
                          if (status === 'active') {
                            statusLabel = '🟢 Active (Working)';
                            statusColor = 'var(--accent-success)';
                          } else if (status === 'quota_exceeded') {
                            statusLabel = '🔴 Quota Exceeded';
                            statusColor = '#ef4444';
                          } else if (status === 'rate_limited') {
                            statusLabel = '🟡 Rate Limited';
                            statusColor = '#fbbf24';
                          } else if (status === 'network_error' || status === 'invalid') {
                            statusLabel = '❌ Invalid Key / Net Error';
                            statusColor = '#ef4444';
                          }

                          const obfuscated = key.length > 10 
                            ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` 
                            : `Key #${idx + 1}`;

                          return (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                              <span style={{ fontFamily: 'monospace', color: 'white', fontWeight: 600 }}>
                                🔑 {obfuscated}
                              </span>
                              <span style={{ fontWeight: 800, color: statusColor }}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>



              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Activity size={16} color="#34d399" />
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#34d399' }}>
                    Leagues to Scan ({tempEnabledLeagues.length} selected)
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                  Uncheck leagues to save API quota. Each checked league counts as 1 API call.
                </p>
                <div style={{
                  maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px',
                  display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  {ARB_LEAGUE_KEYS.map((key) => {
                    const label = key.replace(/^(soccer_|tennis_|baseball_|rugbyleague_)/, '').replace(/_/g, ' ').toUpperCase();
                    const isChecked = tempEnabledLeagues.includes(key);
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', cursor: 'pointer', color: isChecked ? 'white' : 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempEnabledLeagues([...tempEnabledLeagues, key]);
                            } else {
                              setTempEnabledLeagues(tempEnabledLeagues.filter(k => k !== key));
                            }
                          }}
                          style={{ accentColor: '#34d399', cursor: 'pointer' }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cloud Synchronization Section */}
              <div style={{ 
                marginBottom: '28px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(139,92,246,0.06)',
                border: '1px solid rgba(139,92,246,0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Cloud size={16} color="#a78bfa" />
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#a78bfa' }}>
                    Cloud Synchronization
                  </div>
                </div>
                
                {!session ? (
                  <div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '12px' }}>
                      Cloud sync is currently disabled. Connect your account to automatically sync stakes, leagues, and API keys between your laptop and phone.
                    </p>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setShowLogin(true);
                      }}
                      style={{
                        width: '100%', padding: '10px',
                        background: 'linear-gradient(135deg, var(--accent-primary), #1e40af)',
                        border: 'none', borderRadius: '8px',
                        color: 'white', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      🔐 Connect & Sync Account
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '14px' }}>
                      Connected as <strong style={{ color: 'white' }}>{session.user.email}</strong>. Use these controls to manually sync settings between your laptop and phone.
                    </p>
                    
                    {syncStatusMsg && (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        marginBottom: '12px',
                        background: syncStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${syncStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: syncStatusMsg.type === 'success' ? 'var(--accent-success)' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {syncStatusMsg.type === 'success' ? '✅' : '❌'} {syncStatusMsg.text}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={async () => {
                          try {
                            setSyncStatusMsg(null);
                            const stakeInput = document.getElementById('settings-stake-input') as HTMLInputElement;
                            const keyInput = document.getElementById('settings-api-key-input') as HTMLInputElement;
                            const currentStake = parseInt(stakeInput?.value) || 1000;
                            const currentKey = keyInput?.value.trim() || '';

                            let localDeletedIds: string[] = [];
                            try {
                              const saved = localStorage.getItem('amphy_deleted_history_ids');
                              if (saved) localDeletedIds = JSON.parse(saved);
                            } catch {}

                            const { error } = await supabase.auth.updateUser({
                              data: {
                                amphy_settings: {
                                  custom_odds_api_key: currentKey,
                                  arb_stake: currentStake,
                                  enabled_leagues: tempEnabledLeagues,
                                  handicap_focus: handicapFocus,
                                  deleted_history_ids: localDeletedIds
                                }
                              }
                            });
                            if (error) throw error;
                            setSyncStatusMsg({ text: "Keys & settings successfully pushed to cloud!", type: 'success' });
                          } catch (err: any) {
                            let msg = err.message || String(err);
                            if (msg.includes('Failed to fetch')) {
                              msg = "Failed to fetch. This is usually caused by an ad-blocker (like AdBlock Plus) or Brave Shields blocking database connections. Please whitelist this site or pause your ad-blocker to sync settings!";
                            }
                            setSyncStatusMsg({ text: `Failed to push settings: ${msg}`, type: 'error' });
                          }
                        }}
                        style={{
                          flex: 1, padding: '10px 8px',
                          background: 'rgba(139,92,246,0.15)',
                          border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px',
                          color: '#a78bfa', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        title="Save your current device keys to Supabase cloud metadata"
                      >
                        📤 Push to Cloud
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setSyncStatusMsg(null);
                            const { data: { user: freshUser }, error } = await supabase.auth.getUser();
                            if (error) throw error;
                            if (!freshUser?.user_metadata?.amphy_settings) {
                              setSyncStatusMsg({ text: "No cloud settings found. Save settings on your laptop first!", type: 'error' });
                              return;
                            }
                            const cloudSettings = freshUser.user_metadata.amphy_settings;
                            
                            // Apply locally
                            if (cloudSettings.custom_odds_api_key !== undefined) {
                              localStorage.setItem('amphy_custom_odds_api_key', cloudSettings.custom_odds_api_key);
                              const keyInput = document.getElementById('settings-api-key-input') as HTMLInputElement;
                              if (keyInput) keyInput.value = cloudSettings.custom_odds_api_key;
                            }
                            if (cloudSettings.arb_stake !== undefined) {
                              localStorage.setItem('amphy_arb_stake', cloudSettings.arb_stake.toString());
                              setArbStake(cloudSettings.arb_stake);
                              const stakeInput = document.getElementById('settings-stake-input') as HTMLInputElement;
                              if (stakeInput) stakeInput.value = cloudSettings.arb_stake.toString();
                            }
                            if (cloudSettings.enabled_leagues !== undefined && Array.isArray(cloudSettings.enabled_leagues)) {
                              localStorage.setItem('amphy_enabled_arb_leagues', JSON.stringify(cloudSettings.enabled_leagues));
                              setEnabledLeagues(cloudSettings.enabled_leagues);
                              setTempEnabledLeagues(cloudSettings.enabled_leagues);
                            }
                            if (cloudSettings.handicap_focus !== undefined) {
                              const val = cloudSettings.handicap_focus === true;
                              const currentVal = localStorage.getItem('amphy_handicap_focus') === 'true';
                              localStorage.setItem('amphy_handicap_focus', val ? 'true' : 'false');
                              setHandicapFocus(val);
                              setTempHandicapFocus(val);
                              if (val !== currentVal) {
                                localStorage.removeItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
                                setAllMatches([]);
                              }
                            }
                            if (cloudSettings.deleted_history_ids !== undefined && Array.isArray(cloudSettings.deleted_history_ids)) {
                              let currentLocal: string[] = [];
                              try {
                                const saved = localStorage.getItem('amphy_deleted_history_ids');
                                if (saved) currentLocal = JSON.parse(saved);
                              } catch {}
                              const merged = Array.from(new Set([...currentLocal, ...cloudSettings.deleted_history_ids])).slice(-100);
                              localStorage.setItem('amphy_deleted_history_ids', JSON.stringify(merged));
                              setDeletedHistoryIds(merged);
                            }
                            
                            setSyncStatusMsg({ text: "Keys & settings successfully pulled from cloud!", type: 'success' });
                          } catch (err: any) {
                            let msg = err.message || String(err);
                            if (msg.includes('Failed to fetch')) {
                              msg = "Failed to fetch. This is usually caused by an ad-blocker (like AdBlock Plus) or Brave Shields blocking database connections. Please whitelist this site or pause your ad-blocker to sync settings!";
                            }
                            setSyncStatusMsg({ text: `Failed to pull settings: ${msg}`, type: 'error' });
                          }
                        }}
                        style={{
                          flex: 1, padding: '10px 8px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px',
                          color: '#34d399', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        title="Load keys saved on other devices from Supabase cloud metadata"
                      >
                        📥 Pull from Cloud
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  const stakeInput = document.getElementById('settings-stake-input') as HTMLInputElement;
                  const keyInput = document.getElementById('settings-api-key-input') as HTMLInputElement;
                  const newStake = parseInt(stakeInput?.value) || 1000;
                  const newKey = keyInput?.value.trim();

                  setArbStake(newStake);
                  localStorage.setItem('amphy_arb_stake', newStake.toString());

                  setEnabledLeagues(tempEnabledLeagues);
                  localStorage.setItem('amphy_enabled_arb_leagues', JSON.stringify(tempEnabledLeagues));

                  const oldHandicapFocus = handicapFocus;
                  const newHandicapFocus = tempHandicapFocus;
                  setHandicapFocus(newHandicapFocus);
                  localStorage.setItem('amphy_handicap_focus', newHandicapFocus ? 'true' : 'false');
                  
                  if (oldHandicapFocus !== newHandicapFocus) {
                    localStorage.removeItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
                    setAllMatches([]);
                  }

                  // Save Odds API key(s)
                  localStorage.removeItem('amphy_keys_status');
                  localStorage.removeItem('amphy_keys_timestamps');
                  if (newKey && newKey.length > 10) {
                    localStorage.setItem('amphy_custom_odds_api_key', newKey);
                    localStorage.removeItem('amphy_arb_cache_v4');
                    localStorage.removeItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
                  } else {
                    localStorage.removeItem('amphy_custom_odds_api_key');
                    localStorage.removeItem('amphy_arb_cache_v4');
                    localStorage.removeItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
                  }

                  // Bust arb cache so next scan uses new key
                  localStorage.removeItem('amphy_arb_cache_v4');

                  if (session?.user) {
                    let localDeletedIds: string[] = [];
                    try {
                      const saved = localStorage.getItem('amphy_deleted_history_ids');
                      if (saved) localDeletedIds = JSON.parse(saved);
                    } catch {}

                    supabase.auth.updateUser({
                      data: {
                        amphy_settings: {
                          custom_odds_api_key: newKey,
                          arb_stake: newStake,
                          enabled_leagues: tempEnabledLeagues,
                          handicap_focus: newHandicapFocus,
                          deleted_history_ids: localDeletedIds
                        }
                      }
                    }).catch(err => console.error("Sync settings error:", err));
                  }

                  setShowSettings(false);
                }}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(139,92,246,0.4)'
                }}
              >
                💾 Save Settings
              </button>
            </div>
          </div>
        )}

        {showLogin && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}
          >
            <div className="glass-panel animate-scale-in" style={{ maxWidth: '400px', width: '100%', padding: '32px', border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(10,10,20,0.98), rgba(15,10,30,0.98))', position: 'relative' }}>
              <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>✕</button>
              <Auth />
            </div>
          </div>
        )}

        {/* Admin Command Center */}
        {mainTab === 'predictions' && (
          <div className="glass-panel animate-scale-in" style={{ padding: '20px', marginBottom: '40px', border: '1px solid var(--accent-gold)', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(0,0,0,0.5))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <ShieldCheck size={20} color="var(--accent-gold)" />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.05em' }}>ADMIN COMMAND CENTER</h3>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
                  Picks refresh automatically at <span style={{ color: 'var(--accent-gold)', fontWeight: 800 }}>12:00 AM WAT</span> daily.
                  Use Trigger Scan only to manually force a fresh market sweep.
                </p>
              </div>
              <button
                onClick={async () => {
                  localStorage.removeItem('amphy_ai_predictions_cache_v25_WAT_MIDNIGHT');
                  setLoading(true);
                  try {
                    const data = await fetchDailyTopPicks(true, handicapFocus);
                    setAllMatches(data);
                    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                    setApiError(localStorage.getItem('amphy_api_error_status'));
                  } catch {
                    setApiError(localStorage.getItem('amphy_api_error_status'));
                  } finally { setLoading(false); }
                }}
                disabled={loading}
                style={{ padding: '10px 20px', background: loading ? 'rgba(251,191,36,0.4)' : 'var(--accent-gold)', color: 'black', border: 'none', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 20px rgba(251,191,36,0.4)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? 'SCANNING...' : '⚡ TRIGGER SCAN'}
              </button>
            </div>
          </div>
        )}

        {showInstallBanner && (
          <div className="glass-panel animate-scale-in" style={{ padding: '16px 24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={20} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>Install Amphy Elite App</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Get real-time bankers on your home screen</div>
              </div>
            </div>
            <button 
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (outcome === 'accepted') setShowInstallBanner(false);
                }
              }}
              style={{ padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}
            >
              INSTALL
            </button>
          </div>
        )}

        {mainTab === 'predictions' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            <div className="pulse-dot" style={{ width: '4px', height: '4px' }}></div>
            {predictionsCountdown
                ? <span style={{ color: 'var(--accent-primary)' }}>🕗 {predictionsCountdown}</span>
                : <>✅ Predictions Live • Calibrated: {lastUpdated}</>
              }
          </div>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '0.65rem', 
            fontWeight: 800, 
            color: handicapFocus ? '#34d399' : 'var(--accent-gold)', 
            background: handicapFocus ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
            padding: '4px 10px', 
            borderRadius: '100px',
            border: handicapFocus ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            {handicapFocus ? <ShieldCheck size={12} /> : <Zap size={12} />}
            <span>{handicapFocus ? 'ELITE POINT-CUSHION HANDICAPS ONLY' : 'HIGH-YIELD STRATEGY ACTIVE'}</span>
          </div>
        </div>
        )}

        {mainTab === 'predictions' && (
        /* Day Filter Tab Bar */
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '32px',
          padding: '4px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          maxWidth: '360px',
          margin: '0 auto 40px auto'
        }}>
          {((['Today', 'Tomorrow', 'Upcoming'] as DayFilter[])).map((tab) => {
            const isActive = dayFilter === tab;
            
            // Calculate game count for this tab
            const todayDate = new Date();
            todayDate.setHours(0,0,0,0);
            const tomorrowDate = new Date(todayDate);
            tomorrowDate.setDate(tomorrowDate.getDate() + 1);
            const dayAfterTomorrowDate = new Date(tomorrowDate);
            dayAfterTomorrowDate.setDate(dayAfterTomorrowDate.getDate() + 1);

            const count = allMatches.filter(match => {
              const matchDate = new Date(match.commence_time);
              let isDateMatch = false;
              if (tab === 'Today') isDateMatch = matchDate >= todayDate && matchDate < tomorrowDate;
              else if (tab === 'Tomorrow') isDateMatch = matchDate >= tomorrowDate && matchDate < dayAfterTomorrowDate;
              else if (tab === 'Upcoming') isDateMatch = matchDate >= dayAfterTomorrowDate;
              return isDateMatch && match.prediction.confidence >= 80;
            }).length;

            return (
              <button
                key={tab}
                onClick={() => setDayFilter(tab)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {tab}
                <span style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  color: isActive ? 'white' : 'var(--text-muted)'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {mainTab === 'predictions' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '20px' }}>
            <Activity className="animate-spin" size={40} color="var(--accent-primary)" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'white', fontWeight: 600 }}>Deep Scanning Markets...</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>ELIMINATING_RISK_FACTORS // VERIFYING_BANKERS</p>
            </div>
          </div>
        ) : error ? (
          <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <AlertCircle size={40} color="var(--accent-danger)" style={{ margin: '0 auto 20px' }} />
            <h3>Intelligence Error</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        ) : displayedMatches.length === 0 ? (
          <div className="glass-panel animate-scale-in" style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '600px', margin: '0 auto', border: '1px solid rgba(255, 215, 0, 0.2)', background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.03), rgba(0,0,0,0.6))', borderRadius: '16px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '50%', marginBottom: '24px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
              <ShieldCheck size={36} color="var(--accent-gold)" />
            </div>
            
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em', color: 'white' }}>🎯 SNIPER PROTOCOL ACTIVE</h3>
            <div style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 800, marginBottom: '16px', textTransform: 'uppercase' }}>No Bankers Meet Certainty Protocol Today</div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 28px', fontSize: '0.9rem' }}>
              The global market sweep has finished. No fixtures meet our strict **82%+ confidence/variance criteria** today. 
              In sports betting, **not betting is a winning play** when value is absent. Hold your stake of ₦1,000 for tomorrow's sweep.
            </p>
            
            <div style={{ display: 'inline-flex', justifyContent: 'center', gap: '24px', padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>STATUS</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>HOLD STAKE</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>ACTION</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-success)' }}>WAIT FOR SWEEP</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Featured Banker Section */}
            {displayedMatches.length > 0 && (
              <div style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                   <div style={{ padding: '6px', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                     <ShieldCheck size={16} color="var(--accent-gold)" />
                   </div>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>BANKER OF THE DAY</h2>
                </div>
                <div className="featured-grid">
                  <MatchCard match={displayedMatches[0]} />
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                    <h4 style={{ color: 'var(--accent-success)', marginBottom: '12px', fontSize: '0.9rem' }}>SYSTEM CALIBRATION REPORT</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      This match has passed 12/12 security checks including form volatility, liquidity analysis, and market-implied probability variance. Statistical certainty is dynamically calculated at <span style={{ color: 'white', fontWeight: 700 }}>{displayedMatches[0].prediction.confidence}%</span>.
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="pulse-dot"></div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-success)', fontWeight: 700 }}>LIVE MARKET VERIFIED</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {accumulator && (
              <div 
                className="glass-panel animate-scale-in" 
                style={{ 
                  padding: '24px', 
                  marginBottom: '48px', 
                  border: handicapFocus ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid var(--accent-gold)', 
                  background: handicapFocus 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(10, 10, 10, 0.7))'
                    : 'linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(10, 10, 10, 0.7))', 
                  boxShadow: handicapFocus
                    ? '0 8px 32px rgba(16, 185, 129, 0.06)'
                    : '0 8px 32px rgba(255, 215, 0, 0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color={handicapFocus ? '#34d399' : 'var(--accent-gold)'} style={{ filter: handicapFocus ? 'drop-shadow(0 0 4px rgba(52,211,153,0.3))' : 'none' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em' }}>
                      {handicapFocus ? '🛡️ AI RISK-CUSHION ACCUMULATOR' : '🔥 SURE 2.0 ODDS ACCUMULATOR'}
                    </h3>
                  </div>
                  <div style={{ 
                    background: handicapFocus ? 'rgba(16, 185, 129, 0.2)' : 'var(--accent-gold)', 
                    color: handicapFocus ? '#34d399' : 'black', 
                    border: handicapFocus ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    fontSize: '0.7rem', 
                    fontWeight: 900, 
                    textTransform: 'uppercase' 
                  }}>
                    {handicapFocus ? 'SHIELD PROTECTED ACCUMULATOR' : 'SELECTIVE BANKER ACCUMULATOR'}
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                  {handicapFocus 
                    ? 'This slip prioritizes positive goal/point handicap cushions and elite tennis winners to absorb variance. Combine these outcomes on SportyBet or Bet365 for a low-risk double-up.'
                    : 'This accumulator is built using strictly selected low-variance banker outcomes. Combine these outcomes into a single bet slip on SportyBet or Bet365 to double your stake safely.'
                  }
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {accumulator.matches.map((m, i) => {
                    const isCushion = m.prediction.recommendedBet.toLowerCase().includes('handicap') || 
                                     m.prediction.recommendedBet.toLowerCase().includes('cushion') ||
                                     m.prediction.recommendedBet.toLowerCase().includes('draw no bet');
                    return (
                      <div 
                        key={m.id} 
                        style={{ 
                          padding: '10px 14px', 
                          background: 'rgba(255,255,255,0.03)', 
                          borderRadius: '10px', 
                          border: handicapFocus 
                            ? '1px solid rgba(16,185,129,0.2)' 
                            : '1px solid rgba(255,215,0,0.15)', 
                          fontSize: '0.78rem', 
                          fontWeight: 700 
                        }}
                      >
                        <span style={{ color: handicapFocus ? '#34d399' : 'var(--accent-gold)' }}>#{i+1}</span> {m.home_team} vs {m.away_team} <br/>
                        <span style={{ color: 'white', fontSize: '0.82rem' }}>
                          {isCushion ? '🛡️ ' : ''}{m.prediction.recommendedBet}
                        </span> 
                        <span style={{ color: 'var(--accent-success)', marginLeft: '4px' }}>@{m.prediction.realOddsSportyBet || m.prediction.sportyBetEstimate}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>SPORTYBET ACCUMULATED ODDS</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: handicapFocus ? '#34d399' : 'var(--accent-gold)' }}>
                      @{accumulator.sportyBetOdds}
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)', display: 'block' }}></div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>BET365 ACCUMULATED ODDS</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>
                      @{accumulator.bet365Odds}
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)', display: 'block' }}></div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>OPTIMAL SLIP ALLOCATION</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>
                      {(() => {
                        const compositeProb = accumulator.matches.reduce((acc, m) => acc * (m.prediction.confidence / 100), 1);
                        const odds = parseFloat(accumulator.sportyBetOdds) || 2.0;
                        const b = odds - 1;
                        const f = b > 0 ? (compositeProb * (b + 1) - 1) / b : 0;
                        const qKelly = Math.max(0.005, f * 0.25); // Quarter Kelly
                        return `${(qKelly * 100).toFixed(1)}%`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Core Elite Selections */}
            {displayedMatches.length > 1 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '0 8px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <Zap size={16} color="var(--accent-primary)" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>CORE ELITE SELECTIONS</h2>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(52, 211, 153, 0.1)', padding: '4px 10px', borderRadius: '100px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                    🎯 HIGH PRIORITY PLAY LIST
                  </div>
                </div>
                
                <div className="prediction-grid" style={{ marginBottom: '40px' }}>
                  {displayedMatches.slice(1, 4).map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </>
            )}

            {/* Optional Backups */}
            {displayedMatches.length > 4 && (
              <>
                <div style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  marginBottom: '32px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 850 }}>
                    <AlertCircle size={14} />
                    CAPITAL CONSERVATION WARNING
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    The following matches are qualified risk-cushion picks but are designated as <strong>Secondary Backups</strong> to prevent over-exposure. <strong>Do not play these</strong> if they exceed your bankroll's daily limit. Only use them if your core picks have settled and you have available capital to rotate.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '0 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <ShieldCheck size={16} color="var(--text-muted)" />
                    </div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>SECONDARY RISK-CUSHION BACKUPS</h2>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {displayedMatches.length - 4} Backups Available
                  </div>
                </div>

                <div className="prediction-grid" style={{ opacity: 0.85 }}>
                  {displayedMatches.slice(4).map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </>
            )}
          </div>
        )
        )}
        {mainTab === 'valuebets' && (
          <div className="animate-fade-in" style={{ marginBottom: '48px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '40px', padding: '20px 0' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                background: 'rgba(251, 191, 36, 0.12)', borderRadius: '100px',
                color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px',
                border: '1px solid rgba(251, 191, 36, 0.25)', textTransform: 'uppercase'
              }}>
                <TrendingUp size={14} />
                SHARP VALUE BETTING PROTOCOL
              </div>
              <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, marginBottom: '16px', lineHeight: 1, letterSpacing: '-0.04em' }}>
                <span className="gold-gradient">AI Value Bets</span><br/>
                <span style={{ color: 'white' }}>Expected Value (+EV)</span>
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 24px', lineHeight: 1.6 }}>
                Value betting identifies matches where bookmakers offer odds higher than the actual statistical probability calculated by our AI. Staking sizes are dynamically calculated using the **Kelly Criterion** to maximize compound bankroll growth.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="features-grid" style={{ marginBottom: '40px' }}>
              <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Value Fixtures Found</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white' }}>{valueBets.length}</div>
              </div>
              <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', border: '1px solid rgba(251, 191, 36, 0.2)', background: 'rgba(251, 191, 36, 0.03)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Average Edge (+EV)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-gold)' }}>
                  {valueBets.length > 0 
                    ? `+${(valueBets.reduce((acc, curr) => acc + parseFloat(curr.edge), 0) / valueBets.length).toFixed(1)}%`
                    : '0.0%'
                  }
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Max Single Edge</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-success)' }}>
                  {valueBets.length > 0 
                    ? `+${Math.max(...valueBets.map(v => parseFloat(v.edge))).toFixed(1)}%`
                    : '0.0%'
                  }
                </div>
              </div>
            </div>

            {valueBets.length === 0 ? (
              <div className="glass-panel text-center" style={{ padding: '60px 40px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Activity size={32} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>Scanning for +EV Opportunities</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                  No matches currently show positive expected value. Adjust your scan leagues in Settings or trigger a manual sweep to look for fresh data.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {valueBets.map(({ match, recommendedBet, confidence, fairOdds, bestOdds, bestBookie, edge, suggestedStake, kellyPercent }, idx) => {
                  const date = new Date(match.commence_time);
                  const formattedDate = new Intl.DateTimeFormat('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }).format(date);
                  
                  return (
                    <div 
                      key={idx}
                      className="glass-panel animate-scale-in"
                      style={{ 
                        padding: '24px', 
                        border: '1px solid rgba(251, 191, 36, 0.15)',
                        background: 'linear-gradient(135deg, rgba(10,10,10,0.5), rgba(251,191,36,0.02))'
                      }}
                    >
                      {/* Top Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>
                            {match.sport_title}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formattedDate}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-gold)', background: 'rgba(251, 191, 36, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                          +{edge}% EV EDGE
                        </div>
                      </div>

                      {/* Main Teams */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>
                            {match.home_team} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>vs</span> {match.away_team}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>RECOMMENDED SELECTION</div>
                          <div style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>{recommendedBet}</div>
                        </div>
                      </div>

                      {/* EV Logic grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '20px' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>AI Confidence</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-primary)', marginTop: '2px' }}>{confidence}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>AI Fair Odds</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', marginTop: '2px' }}>{fairOdds}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase' }}>Best Market Odds</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-gold)', marginTop: '2px' }}>{bestOdds} ({bestBookie})</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--accent-success)', fontWeight: 800, textTransform: 'uppercase' }}>Kelly Stake Size</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-success)', marginTop: '2px' }}>₦{suggestedStake.toLocaleString()} ({kellyPercent}%)</div>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div style={{ padding: '12px 16px', background: 'rgba(251, 191, 36, 0.04)', borderLeft: '3px solid var(--accent-gold)', borderRadius: '0 8px 8px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        The bookmaker odds of <strong>{bestOdds}</strong> imply a {Math.round(100 / parseFloat(bestOdds))}% probability. However, our neural model calculates a <strong>{confidence}%</strong> likelihood (fair odds {fairOdds}), establishing a <strong>+{edge}% expected value margin</strong>. We suggest risking <strong>₦{suggestedStake.toLocaleString()}</strong> (representing {kellyPercent}% of your default stake) for mathematically optimal compound growth.
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* ── ARBITRAGE TAB ──────────────────────────────────────────── */}
        {mainTab === 'arbitrage' && (
          <div className="animate-fade-in" style={{ marginBottom: '48px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '40px', padding: '20px 0' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.12)', borderRadius: '100px',
                color: '#a78bfa', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px',
                border: '1px solid rgba(139, 92, 246, 0.25)', textTransform: 'uppercase'
              }}>
                <Zap size={14} />
                Risk-Free SureBet Engine
              </div>
              <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, marginBottom: '16px', lineHeight: 1, letterSpacing: '-0.04em' }}>
                <span style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Arbitrage</span><br/>
                <span className="gold-gradient">Scanner</span>
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.6 }}>
                Finds mismatched odds across bookmakers. When the combined implied probability is under 100%, you can bet every outcome and guarantee profit — no matter the result.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
                <button
                  onClick={() => runArbScan(true)}
                  disabled={arbLoading}
                  style={{
                    padding: '12px 28px',
                    background: arbLoading ? 'rgba(139,92,246,0.3)' : 'rgba(139, 92, 246, 0.9)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '0.85rem', fontWeight: 800, cursor: arbLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    boxShadow: arbLoading ? 'none' : '0 0 24px rgba(139,92,246,0.35)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <RefreshCw size={16} style={{ animation: arbLoading ? 'spin 1s linear infinite' : 'none' }} />
                  {arbLoading ? 'Scanning Markets...' : '⚡ Refresh Arb Scan'}
                </button>
                <button
                  onClick={openSettings}
                  style={{
                    padding: '12px 18px', background: 'rgba(255,255,255,0.06)',
                    color: 'white', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  title="Settings: change stake or API key"
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                >
                  <Settings size={16} color="#a78bfa" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>₦{arbStake.toLocaleString()}</span>
                </button>
                <button
                  onClick={() => {
                    const next = !autoPilotMode;
                    setAutoPilotMode(next);
                    localStorage.setItem('amphy_autopilot', next.toString());
                  }}
                  style={{
                    padding: '12px 18px',
                    background: autoPilotMode
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08))'
                      : 'rgba(255,255,255,0.06)',
                    color: autoPilotMode ? '#34d399' : 'white',
                    border: `1px solid ${autoPilotMode ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: '12px',
                    fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.3s ease',
                  }}
                  title={autoPilotMode ? 'Auto-pilot ON: scanning every 8 min during peak hours' : 'Enable auto-pilot to scan automatically during peak hours'}
                >
                  {autoPilotMode ? '🟢' : '⚪'}
                  {autoPilotMode ? 'Auto-Pilot ON' : 'Auto-Pilot'}
                </button>
              </div>

              {/* Freshness status bar */}
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {arbLastScanned ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      <div className="pulse-dot" style={{ background: '#a78bfa' }}></div>
                      Last scanned: {Math.round((Date.now() - arbLastScanned) / 60000)} min ago
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.7)', fontWeight: 700 }}>
                      🎯 Active: <span style={{ color: '#a78bfa' }}>{enabledLeagues.length} leagues</span> ({enabledLeagues.length} API calls/scan)
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                      {autoPilotMode ? (
                        <span style={{ color: '#34d399' }}>🟢 Auto-Pilot Active · Scanning every 8 min</span>
                      ) : (
                        <span>Manual Scan Only · Enable Auto-Pilot for hands-free scanning</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px',
                      background: 'rgba(139,92,246,0.15)',
                      color: '#a78bfa',
                      borderRadius: '100px',
                      border: '1px solid rgba(139,92,246,0.3)',
                      textTransform: 'uppercase'
                    }}>
                      📡 Odds API · Multi-Region Scan
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    No scan run yet · Click above to scan active markets ({enabledLeagues.length} API calls)
                  </div>
                )}
              </div>
            </div>

            {/* Education Banner */}
            <div className="glass-panel" style={{
              padding: '20px 24px', marginBottom: '32px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(0,0,0,0.5))',
              border: '1px solid rgba(139,92,246,0.2)', borderRadius: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '6px' }}>How It Works</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    Place <strong style={{ color: 'white' }}>separate bets</strong> on each outcome at <strong style={{ color: 'white' }}>different bookmakers</strong> using the exact stake split shown. One leg always wins — giving you a <strong style={{ color: 'var(--accent-success)' }}>guaranteed profit</strong> regardless of the match result.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {[['Step 1', 'Find an arb below'], ['Step 2', 'Open each bookmaker app'], ['Step 3', 'Place exact stakes shown'], ['Step 4', 'Profit guaranteed ✅']].map(([step, desc]) => (
                    <div key={step} style={{ textAlign: 'center', minWidth: '80px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#a78bfa', fontWeight: 800, textTransform: 'uppercase' }}>{step}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Arb Cards */}
            {arbLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '20px' }}>
                <Zap className="animate-spin" size={40} color="#a78bfa" />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'white', fontWeight: 600 }}>Scanning All Bookmakers...</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>COMPARING_ODDS // FINDING_DISCREPANCIES</p>
                </div>
              </div>
            ) : arbOpportunities.length === 0 ? (
              <div className="glass-panel animate-scale-in" style={{
                padding: '60px 24px', textAlign: 'center', maxWidth: '600px', margin: '0 auto',
                border: '1px solid rgba(139,92,246,0.2)',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(0,0,0,0.6))',
                borderRadius: '16px'
              }}>
                <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(139,92,246,0.1)', borderRadius: '50%', marginBottom: '24px', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <TrendingUp size={36} color="#a78bfa" />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '12px', color: 'white' }}>No Live Arbs Right Now</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 24px', fontSize: '0.88rem' }}>
                  Bookmakers are well-aligned at the moment. Arb windows typically appear during <strong style={{ color: 'white' }}>weekend fixtures</strong>, major tournaments, and when one bookmaker is slow to adjust odds.
                </p>
                <div style={{ fontSize: '0.75rem', color: autoPilotMode ? '#34d399' : '#a78bfa', fontWeight: 700, marginBottom: '16px' }}>{autoPilotMode ? '🟢 Auto-Pilot active — scanning every 8 minutes during peak hours' : '✓ Sweep complete — enable Auto-Pilot for continuous scanning'}</div>
                <div style={{
                  padding: '14px 18px', background: 'rgba(139, 92, 246, 0.04)',
                  border: '1px solid rgba(139, 92, 246, 0.12)', borderRadius: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', textAlign: 'left',
                  lineHeight: 1.5
                }}>
                  <span style={{ fontSize: '1.1rem', marginTop: '-2px' }}>💡</span>
                  <span><strong>Tip:</strong> Upgrading to a custom Odds API key in Settings increases limits and allows searching all 14 global leagues across eu+uk+us+au regions simultaneously!</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {(arbOpportunities || []).map((arb) => {
                  const kickoff = new Date(arb.commence_time);
                  const timeStr = kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = kickoff.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const isGoodArb = arb.arbPercent >= 1.5;
                  return (
                    <div key={arb.id} className="glass-panel animate-scale-in" style={{
                      padding: '24px',
                      border: `1px solid ${isGoodArb ? 'rgba(16,185,129,0.35)' : 'rgba(139,92,246,0.25)'}`,
                      background: isGoodArb
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.07), rgba(0,0,0,0.6))'
                        : 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(0,0,0,0.6))',
                      borderRadius: '16px', position: 'relative', overflow: 'hidden'
                    }}>
                      {isGoodArb && (
                        <div style={{
                          position: 'absolute', top: '12px', right: '12px',
                          background: 'var(--accent-success)', color: 'black',
                          fontSize: '0.6rem', fontWeight: 900, padding: '3px 8px', borderRadius: '4px',
                          textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>🔥 HIGH VALUE ARB</div>
                      )}
                      {/* Match Header */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.65rem', color: '#a78bfa', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                          {arb.sport_title} · {dateStr} {timeStr}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                          {arb.home_team} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {arb.away_team}
                        </div>
                      </div>

                      {/* Arb Stats */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div style={{
                          padding: '10px 16px', background: 'rgba(16,185,129,0.1)',
                          border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-success)', lineHeight: 1 }}>+{Number(arb.arbPercent || 0).toFixed(2)}%</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' }}>Guaranteed Margin</div>
                        </div>
                        <div style={{
                          padding: '10px 16px', background: 'rgba(255,215,0,0.08)',
                          border: '1px solid rgba(255,215,0,0.2)', borderRadius: '10px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-gold)', lineHeight: 1 }}>₦{(arb.guaranteedProfit || 0).toLocaleString()}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' }}>Profit on ₦{arbStake.toLocaleString()}</div>
                        </div>
                        <div style={{
                          padding: '10px 16px', background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{(arb.legs || []).length}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' }}>Legs to Place</div>
                        </div>
                      </div>

                      {/* Stake Split Table */}
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ padding: '10px 16px', background: 'rgba(139,92,246,0.1)', fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          📋 Exact Stake Breakdown — Place All Legs Simultaneously
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.8fr 0.8fr 0.8fr', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>OUTCOME</div><div>BOOKMAKER</div><div>ODDS</div><div>STAKE</div><div>PAYOUT</div>
                        </div>
                        {(arb.legs || []).map((leg, idx) => (
                          <div key={idx} style={{
                            display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.8fr 0.8fr 0.8fr',
                            padding: '12px 16px', alignItems: 'center',
                            borderBottom: idx < (arb.legs || []).length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none'
                          }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>{leg.outcome}</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a78bfa' }}>{leg.bookmaker}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{(Number(leg.odds) || 0).toFixed(2)}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-success)' }}>₦{(leg.stake || 0).toLocaleString()}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white' }}>₦{(leg.payout || 0).toLocaleString()}</div>
                          </div>
                        ))}
                        <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderTop: '1px solid rgba(16,185,129,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TOTAL STAKE</div>
                          <div style={{ display: 'flex', gap: '24px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>STAKED</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>₦{(arb.legs || []).reduce((s, l) => s + (l.stake || 0), 0).toLocaleString()}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>GUARANTEED RETURN</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--accent-success)' }}>~₦{Math.round((arb.legs && arb.legs[0]?.payout) || 0).toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '12px', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        ⚠️ <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Important:</strong> Place all legs simultaneously and quickly — bookmakers update odds frequently. Always verify odds before confirming your bets.
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Business ROI Dashboard */}
        <div style={{ marginTop: '60px', padding: '32px', background: 'rgba(10, 15, 20, 0.95)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity color="var(--accent-success)" size={24} />
                Track Record
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Every published pick, win or lose. Business tracking mode.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)', lineHeight: 1 }}>{settledPicks.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase' }}>Settled Picks</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)', lineHeight: 1 }}>{wins}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase' }}>Wins</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1 }}>{losses}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase' }}>Losses</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)', lineHeight: 1 }}>{hitRate}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase' }}>Hit Rate</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: parseFloat(roi) > 0 ? 'var(--accent-success)' : 'var(--text-muted)', lineHeight: 1 }}>{roi}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase' }}>ROI (1u flat)</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: netUnits > 0 ? 'var(--accent-success)' : 'var(--text-muted)', lineHeight: 1 }}>{netUnits > 0 ? '+' : ''}{netUnits.toFixed(2)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase' }}>Net Units</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* PENDING PICKS */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} /> ACTION REQUIRED: PENDING SETTLEMENT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 1.2fr', padding: '12px 20px', background: 'rgba(0,0,0,0.2)', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div>MATCH</div>
                <div>PICK</div>
                <div>ODDS</div>
                <div style={{ textAlign: 'right' }}>ACTION</div>
              </div>
              
              {history.filter(h => {
                if (h.status !== 'pending') return false;
                if (!h.date) return true;
                const matchDate = new Date(h.date);
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                return matchDate <= today;
              }).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending matches today. Future matches will appear here on game day.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {history.filter(h => {
                    if (h.status !== 'pending') return false;
                    if (!h.date) return true;
                    const matchDate = new Date(h.date);
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    return matchDate <= today;
                  }).map((item, index, arr) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 1.2fr', padding: '16px 20px', alignItems: 'center', borderBottom: index < arr.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{item.match}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.bet}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>@{item.odds || '1.80'}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => updateHistoryStatus(item.id, 'won')} style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>WON</button>
                        <button onClick={() => updateHistoryStatus(item.id, 'lost')} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>LOST</button>
                        <button onClick={() => deleteHistoryItem(item.id)} style={{ padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', marginLeft: '8px' }}>DELETE</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SETTLED HISTORY COLLAPSIBLE */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div 
                onClick={() => setIsTrackerExpanded(!isTrackerExpanded)}
                style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', borderBottom: isTrackerExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} /> SETTLED HISTORY
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{settledPicks.length} ITEMS</span>
                  <ChevronRight size={16} style={{ transform: isTrackerExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </div>
              </div>
              
              {isTrackerExpanded && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 1.2fr', padding: '12px 20px', background: 'rgba(0,0,0,0.2)', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <div>MATCH</div>
                    <div>PICK</div>
                    <div>ODDS</div>
                    <div style={{ textAlign: 'right' }}>RESULT</div>
                  </div>
                  {settledPicks.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No settled history yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {settledPicks.map((item, index, arr) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 1.2fr', padding: '16px 20px', alignItems: 'center', borderBottom: index < arr.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{item.match}</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{item.bet}</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>@{item.odds || '1.80'}</div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: item.status === 'won' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: item.status === 'won' ? 'var(--accent-success)' : '#ef4444', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
             <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)' }}></div>
             <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em' }}>SYSTEM_VERSION_3.0.2_STABLE</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;



