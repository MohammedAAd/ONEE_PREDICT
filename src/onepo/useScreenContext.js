import { useEffect } from 'react';
import { useOnepo } from './OnepoProvider';

// Une page publie son contexte courant vers ONEPO AI.
// Ex : useScreenContext({ region, centre, cible });
export function useScreenContext(partial) {
  const { publishScreen, clearScreen } = useOnepo();
  const cle = JSON.stringify(partial || {});
  useEffect(() => {
    publishScreen(partial || {});
    return () => clearScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
}