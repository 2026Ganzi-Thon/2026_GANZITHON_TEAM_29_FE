import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';
import { formatMinutes } from '../../utils/time';

// - [쉬어가기] → S11 (물 주며 쉬기)
// - [계속하기] → 창 닫고 S06으로 돌아가기
export default function S12Screen({ navigation, route }) {
  // S06에서 넘겨준 "쉬지 않고 키운 시간(분)". 아직 안 넘어오면 개발용 기본값
  const { minutes = 90 } = route.params ?? {};

  const continueFocus = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('S06');
  };

  return (
    <FarmSheetLayout>
      {/* TODO: 농부 일러스트 최종 그림 나오면 <Image>로 교체 */}
      <View style={styles.illustration}>
        <Text style={styles.illustrationText}>농부 일러스트</Text>
      </View>

      <Text style={styles.title}>{'농부도 쉬어야\n작물이 잘 자라요'}</Text>
      <Text style={styles.subtitle}>
        벌써 {formatMinutes(minutes)}째 쉬지 않고 키웠어요
      </Text>

      <AppButton
        title="쉬어가기"
        onPress={() => navigation.navigate('S11')}
        style={styles.restButton}
      />
      <AppButton title="계속하기" variant="outline" onPress={continueFocus} />
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  illustration: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E6E6E6',
  },

  illustrationText: {
    fontSize: 12,
    color: COLORS.graytext,
  },

  title: {
    marginTop: 20,
    fontSize: 22,
    lineHeight: 33,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.graytext,
    textAlign: 'center',
  },

  restButton: {
    marginTop: 20,
    marginBottom: 16,
  },
});
