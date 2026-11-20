import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import { supabase } from './src/lib/supabase';

const NON_ACTIVE_STATUSES = ['paused', 'completed', 'harvested', 'finished', 'cancelled'];

// 키우는 중에 잠깐 들르는 화면들 (여기 있을 땐 S06으로 끌고 가지 않음)
const FOCUS_FLOW_SCREENS = ['S06', 'S07', 'S09', 'S11', 'S12'];

function resolveRemainingSeconds(sessionObj) {
  if (!sessionObj) return null;

  const endField = sessionObj.ends_at || sessionObj.expires_at || sessionObj.end_at;
  if (endField) {
    const endMs = new Date(endField).getTime();
    if (!Number.isNaN(endMs)) {
      return Math.max(0, Math.round((endMs - Date.now()) / 1000));
    }
  }

  const targetSec = Number(sessionObj.target_seconds || sessionObj.targetSeconds || 0);
  if (sessionObj.started_at && targetSec > 0) {
    const startMs = new Date(sessionObj.started_at).getTime();
    if (!Number.isNaN(startMs)) {
      const elapsedSec = Math.round((Date.now() - startMs) / 1000);
      return Math.max(0, targetSec - elapsedSec);
    }
  }

  if (sessionObj.remaining_seconds !== undefined && sessionObj.remaining_seconds !== null) {
    return Math.max(0, Math.round(Number(sessionObj.remaining_seconds)));
  }

  return null;
}

export default function App() {
  const isCheckingRef = useRef(false);

  const redirectIfActiveFocus = async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      if (!navigationRef.isReady()) return;

      const { data, error } = await supabase.rpc('get_active_focus');
      if (error) {
        console.log('❌ [App] get_active_focus 에러:', error.message);
        return;
      }

      // 키우는 중인 게 없으면 session이 null로 옴
      const activeSession = data?.session ?? null;
      if (!activeSession) return;

      const status = String(activeSession.status || '').toLowerCase();
      if (NON_ACTIVE_STATUSES.includes(status)) return;

      const remaining = resolveRemainingSeconds(activeSession);
      if (remaining !== null && remaining <= 0) return;

      const currentRouteName = navigationRef.getCurrentRoute()?.name;
      if (FOCUS_FLOW_SCREENS.includes(currentRouteName)) return;

      const plotIdx =
        typeof activeSession.plot_index === 'number'
          ? Math.max(0, activeSession.plot_index - 1)
          : 0;

      const targetSec =
        activeSession.target_seconds || activeSession.targetSeconds || undefined;

      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'S03' },
          {
            name: 'S06',
            params: {
              plotIndex: plotIdx,
              cropId: activeSession.crop_id,
              sessionId: activeSession.session_id,
              cropName: activeSession.crop_name,
              ...(targetSec ? { targetSeconds: Number(targetSec) } : {}),
              ...(remaining !== null ? { remainingSeconds: remaining } : {}),
            },
          },
        ],
      });
    } catch (e) {
      console.log('❌ [App] redirectIfActiveFocus 예외:', e?.message);
    } finally {
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    // startScreen 로딩이 끝나고 NavigationContainer가 준비될 때까지 짧게 폴링 후 1회 실행
    let attempts = 0;
    const pollTimer = setInterval(() => {
      attempts += 1;
      if (navigationRef.isReady()) {
        clearInterval(pollTimer);
        redirectIfActiveFocus();
      } else if (attempts >= 30) {
        clearInterval(pollTimer);
      }
    }, 100);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        redirectIfActiveFocus();
      }
    });

    return () => {
      clearInterval(pollTimer);
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}