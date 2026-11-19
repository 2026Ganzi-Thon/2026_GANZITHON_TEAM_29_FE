import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../lib/supabase';
import SettingsMenu from './SettingsMenu';

const SettingsContext = createContext({ canOpen: false, open: () => {} });

// 어느 화면에서든 농장의 창고를 누르면 설정 창이 열리도록 앱 맨 바깥에 하나만 둠
export function SettingsProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      if (!session) setVisible(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  // 로그인 전(S18, S19)에는 창고를 눌러도 안 열림
  const value = useMemo(() => ({ canOpen: loggedIn, open }), [loggedIn, open]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
      <SettingsMenu visible={visible} onClose={close} />
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
