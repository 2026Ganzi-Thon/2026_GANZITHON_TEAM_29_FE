import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';
import { eulReul } from '../../utils/josa';

// S10 · 수확 완료 화면
// - [쉬어가기] → S11 (물 주며 쉬기)
// - [건너뛰기] → 쉬어가기 안내 박스만 닫힘
// - [농장으로 가기] → S03
export default function S10Screen({ navigation, route }) {
  // 이전 화면(S17)에서 넘겨준 값. 아직 안 넘어오면 개발용 기본값 사용
  const { cropName = '당근', minutes = 20 } = route.params ?? {};

  const [showRestCard, setShowRestCard] = useState(true);
  const [memo, setMemo] = useState('');

  const goToFarm = () => {
    // TODO: 백엔드 연결되면 memo(오늘 한 줄) 서버에 저장하기

    // popTo: 스택에 이미 S03이 있으면 그 화면으로 돌아감 (화면이 계속 쌓이는 것 방지)
    navigation.popTo('S03', { justHarvested: true });
  };

  return (
    // TODO(3D 2번 파트): 작물이 밭에서 튀어 오르며 반짝이는 수확 연출(1.5초)
    //   → 완성되면 <FarmSheetLayout farmArea={<수확장면 />}> 형태로 넣기
    <FarmSheetLayout>
      <Text style={styles.title}>{eulReul(cropName)} 수확했어요!</Text>
      <Text style={styles.subtitle}>{minutes}분 동안 함께 키웠어요</Text>

      {showRestCard && (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>5분 물 주며 쉬어갈까요?</Text>

          <View style={styles.restButtons}>
            <AppButton
              title="쉬어가기"
              onPress={() => navigation.navigate('S11')}
              style={styles.restButton}
            />
            <AppButton
              title="건너뛰기"
              variant="outline"
              onPress={() => setShowRestCard(false)}
              style={styles.restButton}
            />
          </View>
        </View>
      )}

      <TextInput
        style={styles.memoInput}
        placeholder="오늘 한 줄 남기기 (선택)"
        placeholderTextColor={COLORS.darkGray}
        value={memo}
        onChangeText={setMemo}
        maxLength={50}
        returnKeyType="done"
      />

      <AppButton title="농장으로 가기" onPress={goToFarm} />
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.graytext,
    textAlign: 'center',
  },

  restCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.Gray,
  },

  restTitle: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },

  restButtons: {
    flexDirection: 'row',
    gap: 10,
  },

  restButton: {
    flex: 1, // 두 버튼이 반반씩 나눠 가짐
    width: undefined,
  },

  memoInput: {
    height: 50,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.darkGray,
    borderRadius: 12,
    fontSize: 14,
    color: COLORS.black,
  },
});
