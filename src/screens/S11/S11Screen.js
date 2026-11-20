import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';
import { supabase } from '../../utils/supabase';
import { createWatering } from '../../components/farm/wateringScene';

// S11 물 주며 쉬기 (5분)
// - 수확 후(S10): 다 쉬면 농장으로
// - 키우는 도중(S12 과로 안내): 작물은 일시정지해 두고, 다 쉬면 다시 키우러 S06으로

const REST_SECONDS = 5 * 60;
const DONE_DELAY_MS = 3000;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// S10에서 start_rest 응답(restEndsAt, serverNow)을 넘겨주면 서버 기준으로 남은 시간 계산
function initialRemainingMs(params) {
  if (params?.restEndsAt && params?.serverNow) {
    return Math.max(0, Date.parse(params.restEndsAt) - Date.parse(params.serverNow));
  }
  return REST_SECONDS * 1000;
}

export default function S11Screen({ navigation, route }) {
  // 쉬는 밭에만 물을 줌
  const plotIndex = route.params?.plotIndex;
  const focusRest = route.params?.focusRest === true;
  const sessionId = route.params?.sessionId;
  const watering = useMemo(() => createWatering(plotIndex), [plotIndex]);

  // 폰 시계가 서버와 달라도 괜찮도록 "지금부터 몇 ms 남았는지"만 가져와서 끝나는 시각을 정함
  const endAtRef = useRef(Date.now() + initialRemainingMs(route.params));
  const [remaining, setRemaining] = useState(
    Math.ceil((endAtRef.current - Date.now()) / 1000)
  );
  const done = remaining === 0;
  const leavingRef = useRef(false);

  const backToGrowing = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    if (sessionId && !String(sessionId).startsWith('local_')) {
      const { error } = await supabase.rpc('resume_focus', { p_session_id: sessionId });
      if (error) console.log('다시 키우기 실패:', error.message);
    }

    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('S06', { plotIndex });
  }, [navigation, plotIndex, sessionId]);

  const goToFarm = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    navigation.popTo('S03');
  }, [navigation]);

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(timer);
    }, 250);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!done) return;
    const timeout = setTimeout(focusRest ? backToGrowing : goToFarm, DONE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [done, focusRest, backToGrowing, goToFarm]);

  // 키우다 쉬는 중엔 뒤로가기도 다시 키우기로 처리
  useEffect(() => {
    if (!focusRest) return;
    navigation.setOptions({ gestureEnabled: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backToGrowing();
      return true;
    });
    return () => sub.remove();
  }, [focusRest, navigation, backToGrowing]);

  return (
    <FarmSheetLayout onFarmReady={watering}>
      <Text style={styles.title}>{done ? '다 쉬었어요!' : '물 주며 쉬는 중'}</Text>
      <Text style={styles.timer}>{formatTime(remaining)}</Text>
      <Text style={styles.subtitle}>
        {done
          ? focusRest
            ? '곧 다시 키우러 가요'
            : '곧 농장으로 이동해요'
          : '눈을 감고 숨을 세 번 쉬어 보세요'}
      </Text>

      {focusRest ? (
        <AppButton title="계속 키우기" onPress={backToGrowing} style={styles.replantButton} />
      ) : (
        <>
          {/* 농장으로 돌아가서 원하는 빈 밭을 직접 골라 심기 */}
          <AppButton
            title="다시 심기"
            onPress={() => navigation.popTo('S03', { replant: true })}
            style={styles.replantButton}
          />
          <AppButton title="농장으로" variant="text" onPress={goToFarm} />
        </>
      )}
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  timer: {
    marginTop: 12,
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.graytext,
    textAlign: 'center',
  },

  replantButton: {
    marginTop: 20,
    marginBottom: 4,
  },
});
