import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed it recently (within 7 days)
    const dismissed = localStorage.getItem('diabp_install_prompt_dismissed');
    const now = Date.now();
    if (dismissed && now - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Check if app is already running in standalone (installed) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) {
      return;
    }

    // Show the banner by default if not installed
    setShowPrompt(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
        setShowPrompt(false);
      });
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('diabp_install_prompt_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div 
      className="glass-panel animate-scale-up"
      style={{
        margin: '12px auto',
        maxWidth: '1200px',
        width: 'calc(100% - 32px)',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%)',
        border: '1px solid rgba(20, 184, 166, 0.25)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 99
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
        <div style={{
          background: 'rgba(20, 184, 166, 0.2)',
          padding: '8px',
          borderRadius: '12px',
          color: '#14b8a6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(20, 184, 166, 0.15)'
        }}>
          <Smartphone size={20} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 2px 0', fontSize: '0.85rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Install DiaBP-Copilot Mobile App
            <span style={{ fontSize: '0.6rem', background: '#3b82f6', color: 'white', padding: '1px 6px', borderRadius: '50px', textTransform: 'uppercase', fontWeight: 'bold' }}>PWA Install</span>
          </h4>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.4' }}>
            {isIOS 
              ? "To install on your iPhone, tap the Share button (square with arrow up) in Safari and select 'Add to Home Screen'."
              : deferredPrompt
                ? "Add DiaBP-Copilot to your home screen for quick health tracking, faster loading times, and offline access."
                : "To install, tap your browser menu (the three dots ⋮ in Chrome) and select 'Install app' or 'Add to Home Screen'."
            }
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              color: '#0d1117',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
              transition: 'transform 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Download size={12} /> Install App
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
