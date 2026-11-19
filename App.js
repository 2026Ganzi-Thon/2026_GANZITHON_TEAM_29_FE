import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase } from './src/utils/supabase';

const NON_ACTIVE_STATUSES = ['paused', 'completed', 'harvested', 'finished', 'cancelled'];

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

      const status = String(activeSession.status || '').toLowerCase();
      // 일시정지(paused) 및 이미 끝난 세션은 S06으로 강제 이동하지 않음
      if (NON_ACTIVE_STATUSES.includes(status)) return;

      const remaining =
        activeSession.remaining_seconds !== undefined && activeSession.remaining_seconds !== null
          ? Number(activeSession.remaining_seconds)
          : null;
      if (remaining !== null && remaining <= 0) return;

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