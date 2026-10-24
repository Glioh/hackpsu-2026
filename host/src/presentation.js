// Call request() directly inside a click handler to preserve user activation.
export function createPresentation(screen, doc = document) {
  return {
    request() {
      if (doc.fullscreenElement === screen) return;
      try {
        const request = screen.requestFullscreen || screen.webkitRequestFullscreen;
        Promise.resolve(request?.call(screen, { navigationUI: 'hide' })).catch(() => {});
      } catch { /* The viewport-filling CSS remains available. */ }
    },
    setPhase(phase) {
      const active = phase === 'playing' || phase === 'paused';
      doc.body.classList.toggle('game-focus', active);
      screen.classList.toggle('match-active', active);
      if (!active && doc.fullscreenElement === screen) {
        try { Promise.resolve(doc.exitFullscreen?.()).catch(() => {}); } catch { /* Browser already exited. */ }
      }
    },
  };
}
