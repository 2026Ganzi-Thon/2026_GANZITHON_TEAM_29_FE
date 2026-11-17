import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';


// - [다시 심기] → 작물 고르는 화면
// - [농장으로] → S03

const REST_SECONDS = 5 * 60; // 쉬는 시간 5분

// TODO: 작물 고르는 화면 번호 팀원분께 확인하기 (지금은 임시로 S04)
const CROP_SELECT_SCREEN = 'S04';

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function S11Screen({ navigation }) {
  const [remaining, setRemaining] = useState(REST_SECONDS);

  const endAtRef = useRef(Date.now() + REST_SECONDS * 1000);

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
    // TODO(3D 2번 파트): 농장 전체에 물을 주는 연출
    //   → 완성되면 <FarmSheetLayout farmArea={<물주기장면 />}> 형태로 넣기
    <FarmSheetLayout>
      <Text style={styles.title}>물 주며 쉬는 중</Text>
      <Text style={styles.timer}>{formatTime(remaining)}</Text>
      <Text style={styles.subtitle}>눈을 감고 숨을 세 번 쉬어 보세요</Text>

      <AppButton
        title="다시 심기"
        onPress={() => navigation.navigate(CROP_SELECT_SCREEN)}
        style={styles.replantButton}
      />
      <AppButton
        title="농장으로"
        variant="text"
        onPress={() => navigation.popTo('S03')}
      />
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
