import React, { useState, useEffect } from 'react';
import { Activity, LogOut, ShieldCheck, Cpu, Settings } from 'lucide-react';
import { supabase } from '../services/supabase';

interface HeaderProps {
  session: any;
  onLoginClick: () => void;
  onSettingsClick: () => void;
  arbStake: number;
}

export const Header: React.FC<HeaderProps> = ({ session, onLoginClick, onSettingsClick, arbStake }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [apiStatus, setApiStatus] = useState<{
    status: 'working' | 'fallback' | 'rate-limited' | 'error';
    message: string;
    timestamp: number;
  }>({
    status: 'working',
    message: 'Primary Intelligence active',
    timestamp: Date.now()
  });

  useEffect(() => {
    const checkStatus = () => {
      const saved = localStorage.getItem('amphy_api_status');
      if (saved) {
        try {
          setApiStatus(JSON.parse(saved));
        } catch {}
      }
    };

    checkStatus();
    // Poll every 2.5 seconds to capture runtime events
    const interval = setInterval(checkStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  const getStatusDetails = () => {
    switch (apiStatus.status) {
      case 'working':
        return {
          color: 'var(--accent-success)',
          text: 'PRIMARY_ACTIVE',
          bg: 'rgba(16, 185, 129, 0.1)'
        };
      case 'rate-limited':
        return {
          color: '#f97316',
          text: 'KEY_ROTATION',
          bg: 'rgba(249, 115, 22, 0.1)'
        };
      case 'fallback':
        return {
          color: 'var(--accent-gold)',
          text: 'BACKUP_ACTIVE',
          bg: 'rgba(255, 215, 0, 0.1)'
        };
      case 'error':
        return {
          color: '#ef4444',
          text: 'OFFLINE_ERR',
          bg: 'rgba(239, 68, 68, 0.1)'
        };
      default:
        return {
          color: 'var(--accent-gold)',
          text: 'PRIMARY_ACTIVE',
          bg: 'rgba(255, 215, 0, 0.1)'
        };
    }
  };

  const details = getStatusDetails();

  return (
    <header className="glass-panel" style={{ 
      margin: '24px 0', 
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: '24px',
      zIndex: 100,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(5, 5, 5, 0.5)',
      backdropFilter: 'blur(12px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, var(--accent-primary), #1e40af)', 
          padding: '10px', 
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        }}>
          <Activity size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>AMPHY <span className="gold-gradient">ELITE</span> <span style={{ fontSize: '0.6rem', background: 'var(--accent-gold)', color: 'black', padding: '2px 4px', borderRadius: '4px', verticalAlign: 'middle' }}>V3</span></h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <ShieldCheck size={10} color="var(--accent-gold)" />
             <p style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elite Predictive Intelligence</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="streak-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <ShieldCheck size={14} color="var(--accent-success)" />
          <span className="streak-text" style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-success)' }}>
            STREAK: 
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'white' }}>
            {(() => {
              try {
                const hist = localStorage.getItem('amphy_ai_history');
                if (hist) {
                  const parsed = JSON.parse(hist);
                  if (Array.isArray(parsed)) {
                    return parsed.filter((h: any) => h.status === 'won').length;
                  }
                }
              } catch {}
              return 0;
            })()}
          </span>
        </div>

        {/* Dynamic API Status Intelligence Badge */}
        <div 
          className="header-status" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '6px 12px', 
            background: details.bg, 
            borderRadius: '10px', 
            border: `1px solid ${details.color}33`, 
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            background: details.color, 
            boxShadow: `0 0 8px ${details.color}`,
            animation: 'pulse 2s infinite' 
          }}></div>
          <span className="header-status-text" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>
            {details.text}
          </span>
          
          {/* Tooltip on hover */}
          <div className="status-tooltip" style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'rgba(10, 10, 10, 0.98)',
            border: `1px solid ${details.color}44`,
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.65rem',
            color: 'white',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 1000,
            opacity: isHovered ? 1 : 0,
            pointerEvents: 'none',
            transform: isHovered ? 'translateY(0)' : 'translateY(-5px)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '220px',
            whiteSpace: 'normal',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: 800, color: details.color, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.02em' }}>
              <Cpu size={10} /> NETWORK INTELLIGENCE
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
              {apiStatus.message}
            </div>
            <div style={{ fontSize: '0.55rem', marginTop: '6px', opacity: 0.4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
              Checked: {new Date(apiStatus.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* System Settings trigger button */}
        <button 
          onClick={onSettingsClick}
          style={{ 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: 'white', 
            cursor: 'pointer', 
            padding: '8px 12px',
            borderRadius: '10px',
            display: 'flex', 
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontWeight: 800,
            transition: 'all 0.2s'
          }}
          title="System Settings: change stake or API key"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          <Settings size={14} color="#a78bfa" style={{ transition: 'transform 0.3s ease' }} className="settings-gear" />
          <span>₦{arbStake.toLocaleString()}</span>
        </button>
        
        {session ? (
          <button 
            onClick={() => supabase.auth.signOut()}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: 'rgba(255,255,255,0.8)', 
              cursor: 'pointer', 
              padding: '8px 12px',
              borderRadius: '10px',
              display: 'flex', 
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
            title="Disconnect Account Sync"
          >
            <LogOut size={14} /> Disconnect
          </button>
        ) : (
          <button 
            onClick={onLoginClick}
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-primary), #1e40af)', 
              border: '1px solid rgba(59, 130, 246, 0.3)', 
              color: 'white', 
              cursor: 'pointer', 
              padding: '8px 14px',
              borderRadius: '10px',
              display: 'flex', 
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              transition: 'all 0.2s'
            }}
            title="Sync laptop & phone data"
          >
            <Cpu size={14} /> Sync Account
          </button>
        )}
      </div>
    </header>
  );
};
