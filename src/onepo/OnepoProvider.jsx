import React, { createContext, useContext, useState, useCallback } from 'react';

const OnepoContext = createContext(null);

// Enveloppe l'application : détient le contexte d'écran courant pour ONEPO AI.
export function OnepoProvider({ activePage, children }) {
  const [screen, setScreen] = useState({});
  const publishScreen = useCallback((partial) => setScreen(partial || {}), []);
  const clearScreen = useCallback(() => setScreen({}), []);
  return (
    <OnepoContext.Provider value={{ activePage, screen, publishScreen, clearScreen }}>
      {children}
    </OnepoContext.Provider>
  );
}

export function useOnepo() {
  const ctx = useContext(OnepoContext);
  if (!ctx) throw new Error('useOnepo doit être utilisé dans <OnepoProvider>');
  return ctx;
}