import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase } from './src/utils/supabase';

export default function App() {
  const navigationRef = useRef(null);
  const isCheckingRef = useRef(false);

  const redirectIfActiveFocus = async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const nav = navigationRef.current;
      if (!nav || !nav.isReady()) return;

      const { data, error } = await supabase.rpc('get_active_focus');
      if (error) return;

      const activeSession = data?.session ?? data ?? null;
      if (!activeSession) return;

      // 사용자가 의도적으로 일시정지한 세션(paused)은 S06으로 강제 이동하지 않음
      if (activeSession.status === 'paused') return;

      const currentRouteName = nav.getCurrentRoute()?.name;
      if (currentRouteName === 'S06') return;

      const plotIdx =
        typeof activeSession.plot_index === 'number'
          ? Math.max(0, activeSession.plot_index - 1)
          : 0;

      nav.navigate('S06', {
        plotIndex: plotIdx,
        cropId: activeSession.crop_id,
        sessionId: activeSession.session_id,
        cropName: activeSession.crop_name,
      });
    } catch (e) {
      // 무시
    } finally {
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        redirectIfActiveFocus();
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator
        ref={navigationRef}
        onReady={redirectIfActiveFocus}
      />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}