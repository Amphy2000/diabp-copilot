import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
    } else {
      // Fallback instruction for browsers where PWA trigger isn't ready
      alert("To install DiaBP-Copilot on your home screen:\n\n1. Tap your browser menu (the three dots ⋮ in Chrome).\n2. Select 'Install app' or 'Add to Home screen'.");
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
        margin: '16px auto 0 auto',
        maxWidth: '650px',
        width: 'calc(100% - 32px)',
        padding: '10px 20px',
        background: 'rgba(20, 20, 22, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        fontSize: '0.78rem',
        color: '#e2e8f0',
        zIndex: 99,
        flexWrap: 'wrap',
        textAlign: 'center'
      }}
    >
      {isIOS ? (
        <span>
          📱 Install DiaBP-Copilot on your home screen: Tap Share 📤 and select 'Add to Home Screen'
        </span>
      ) : (
        <>
          <span>
            📱 Install DiaBP-Copilot on your home screen for quick access!
          </span>
          <button
            onClick={handleInstall}
            style={{
              background: '#14b8a6',
              color: '#0d1117',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 14px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              boxShadow: '0 2px 8px rgba(20, 184, 166, 0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Install
          </button>
        </>
      )}

      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '2px',
          marginLeft: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
        title="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
};
