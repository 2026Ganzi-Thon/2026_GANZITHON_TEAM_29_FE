import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';
import { createWatering } from '../../components/farm/wateringScene';

// S11 물 주며 쉬기 (5분)

const REST_SECONDS = 5 * 60;

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
  // 방금 수확한 밭에만 물을 줌
  const plotIndex = route.params?.plotIndex;
  const watering = useMemo(() => createWatering(plotIndex), [plotIndex]);

  // 폰 시계가 서버와 달라도 괜찮도록 "지금부터 몇 ms 남았는지"만 가져와서 끝나는 시각을 정함
  const endAtRef = useRef(Date.now() + initialRemainingMs(route.params));
  const [remaining, setRemaining] = useState(
    Math.ceil((endAtRef.current - Date.now()) / 1000)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);

      if (left === 0) {
        clearInterval(timer);
        // TODO: 5분 다 쉬었을 때 동작 정하기 (지금은 00:00에서 멈춤)
      }
    }, 250);

    return () => clearInterval(timer);
  }, []);

  return (
    <FarmSheetLayout onFarmReady={watering}>
      <Text style={styles.title}>물 주며 쉬는 중</Text>
      <Text style={styles.timer}>{formatTime(remaining)}</Text>
      <Text style={styles.subtitle}>눈을 감고 숨을 세 번 쉬어 보세요</Text>

      {/* 농장으로 돌아가서 원하는 빈 밭을 직접 골라 심기 */}
      <AppButton
        title="다시 심기"
        onPress={() => navigation.popTo('S03', { replant: true })}
        style={styles.replantButton}
      />
      <AppButton title="농장으로" variant="text" onPress={() => navigation.popTo('S03')} />
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
