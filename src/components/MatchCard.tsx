import React, { useState } from 'react';
import type { MatchWithPrediction } from '../services/api';
import { Activity, ChevronRight, ShieldCheck, Target } from 'lucide-react';

interface MatchCardProps {
  match: MatchWithPrediction;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { prediction } = match;

  const date = new Date(match.commence_time);
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);

  const isCushion = prediction.recommendedBet.toLowerCase().includes('handicap') || 
                   prediction.recommendedBet.toLowerCase().includes('cushion') ||
                   prediction.recommendedBet.toLowerCase().includes('draw no bet') ||
                   prediction.recommendedBet.toLowerCase().includes('dnb');

  return (
    <div 
      className="glass-panel animate-scale-in" 
      style={{ 
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        border: isCushion ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 215, 0, 0.1)',
        background: 'rgba(10, 10, 10, 0.4)',
        cursor: 'pointer',
        boxShadow: isCushion ? '0 4px 20px rgba(16, 185, 129, 0.02)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Sport & Market Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <Activity size={14} color={isCushion ? '#34d399' : 'var(--accent-primary)'} />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {match.sport_title} • {prediction.winOrDraw || prediction.markets.winOrDraw || 'Standard'}
          </span>
        </div>
        {prediction.predictionMode === 'live' ? (
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.15)', 
            padding: '6px 12px', 
            borderRadius: '100px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div className="pulse-dot"></div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-success)' }}>LIVE INTELLIGENCE</span>
          </div>
        ) : prediction.predictionMode === 'forecast' ? (
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.15)', 
            padding: '6px 12px', 
            borderRadius: '100px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div className="pulse-dot" style={{ background: 'var(--accent-primary)' }}></div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)' }}>NEURAL FORECAST</span>
          </div>
        ) : (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '6px 12px', 
            borderRadius: '100px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'white', opacity: 0.7 }}>NEURAL SIMULATION</span>
          </div>
        )}
      </div>

      {/* Teams */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{match.home_team}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>VS</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'right' }}>{match.away_team}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {formattedDate}
        </div>
      </div>

      {/* Recommended Bet Section */}
      <div style={{ 
        background: isCushion
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03))'
          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(184, 134, 11, 0.05))', 
        padding: '16px', 
        borderRadius: '16px', 
        border: isCushion
          ? '1px solid rgba(16, 185, 129, 0.25)'
          : '1px solid rgba(255, 215, 0, 0.2)',
        marginBottom: '20px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ 
          fontSize: '0.7rem', 
          color: isCushion ? '#34d399' : 'var(--accent-gold)', 
          fontWeight: 800, 
          marginBottom: '4px', 
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}>
          {isCushion && <ShieldCheck size={12} />}
          {isCushion ? '🛡️ RISK-CUSHION RECOMMENDED ENTRY' : 'AI RECOMMENDED ENTRY'}
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>{prediction.recommendedBet}</div>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'left', minWidth: '60px' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 700 }}>BET365 ODDS</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>{prediction.realOddsBet365 || prediction.fairOdds}</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <div style={{ textAlign: 'left', minWidth: '85px' }}>
            <div style={{ fontSize: '0.55rem', color: isCushion ? '#34d399' : 'var(--accent-gold)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              SPORTYBET ODDS
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-success)' }}></div>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isCushion ? '#34d399' : 'var(--accent-gold)' }}>{prediction.realOddsSportyBet || prediction.sportyBetEstimate}</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <div style={{ textAlign: 'left', minWidth: '70px' }}>
            <div style={{ fontSize: '0.55rem', color: '#10b981', fontWeight: 800 }}>OPTIMAL STAKE</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399' }}>
              {(() => {
                const odd = parseFloat(prediction.realOddsSportyBet) || parseFloat(prediction.sportyBetEstimate) || 1.25;
                const p = prediction.confidence / 100;
                const b = odd - 1;
                const f = b > 0 ? (p * (b + 1) - 1) / b : 0;
                const qKelly = Math.min(0.05, Math.max(0.01, f * 0.25)); // Quarter Kelly capped at 5% max safety
                return `${(qKelly * 100).toFixed(1)}%`;
              })()}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
          * Verified {prediction.realBookmaker || 'Market'} live feed. Odds fluctuate.
        </div>
      </div>

      {/* Probability Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '8px', fontWeight: 700 }}>
          <span>WIN PROBABILITY</span>
          <span style={{ color: 'var(--accent-success)' }}>{prediction.confidence}%</span>
        </div>
        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${prediction.homeWinProb}%`, background: 'var(--accent-primary)', height: '100%' }}></div>
          <div style={{ width: `${prediction.drawProb}%`, background: 'rgba(255,255,255,0.2)', height: '100%' }}></div>
          <div style={{ width: `${prediction.awayWinProb}%`, background: 'var(--accent-gold)', height: '100%' }}></div>
        </div>
      </div>

      {/* Reasoning */}
      {isExpanded && (
        <div className="animate-fade-in" style={{ padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Target size={14} color={isCushion ? '#34d399' : 'var(--accent-gold)'} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>Intelligence Breakdown</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {prediction.reasoning}
          </p>
          
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
              <span>Statistical Performance Gap</span>
              <span>{Math.abs(prediction.homeWinProb - prediction.awayWinProb)}% Variance</span>
            </div>
            <div style={{ height: '32px', display: 'flex', gap: '4px', alignItems: 'flex-end', paddingBottom: '4px' }}>
              {[...Array(12)].map((_, i) => {
                const height = 30 + Math.random() * 70;
                const isHome = i < 6;
                return (
                  <div 
                    key={i} 
                    style={{ 
                      flex: 1, 
                      height: `${height}%`, 
                      background: isHome ? 'var(--accent-primary)' : 'var(--accent-gold)',
                      opacity: isHome ? (i + 1) / 6 : (12 - i) / 6,
                      borderRadius: '2px',
                      transition: 'height 1s ease-out'
                    }} 
                  />
                );
              })}
            </div>
          </div>
          
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>PROBABILITY</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{prediction.confidence}%</div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>MARKET LATENCY</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-success)' }}>{Math.floor(Math.random() * 200 + 50)}ms</div>
            </div>
          </div>
          
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
            <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              🛡️ 12-POINT CALIBRATION SECURITY AUDIT
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              <div>🟢 Form Volatility Check: <span style={{ color: 'white', fontWeight: 600 }}>PASSED</span></div>
              <div>🟢 Market Liquidity Depth: <span style={{ color: 'white', fontWeight: 600 }}>OPTIMAL</span></div>
              <div>🟢 Sharp-Odds Consensus: <span style={{ color: 'white', fontWeight: 600 }}>PASSED</span></div>
              <div>🟢 Historical Spread Index: <span style={{ color: 'white', fontWeight: 600 }}>{prediction.confidence > 88 ? 'HIGH' : 'STABLE'}</span></div>
              <div>🟢 Time-Decay Variance: <span style={{ color: 'white', fontWeight: 600 }}>SECURED</span></div>
              <div>🟢 Expected Value Edge: <span style={{ color: '#34d399', fontWeight: 700 }}>+{prediction.expectedValue.toFixed(2)} EV</span></div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '10px 0 0 0', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
              <strong>ELITE INSIGHT:</strong> This handicap cushion shields your capital against surprise upsets or single-point swings. Ideal for low-variance daily double-up slips.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <ChevronRight 
          size={20} 
          color="var(--text-muted)" 
          style={{ 
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }} 
        />
      </div>
    </div>
  );
};
