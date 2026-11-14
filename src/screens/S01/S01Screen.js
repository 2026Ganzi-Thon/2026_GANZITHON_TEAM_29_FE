import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { commonStyles } from '../../styles/commonStyles';

import FarmScene3D from '../../components/farm/FarmScene3D';
import BottomCardModal from '../../components/common/BottomCardModal';
import PrimaryButton from '../../components/common/PrimaryButton';

export default function S01Screen({ navigation }) {
  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D />
      </View>

      <SafeAreaView style={styles.content} pointerEvents="box-none">
        <View style={styles.topSpacer} />

        <BottomCardModal>
          <Text style={[commonStyles.title, styles.titleText]}>
            집중한 만큼,{'\n'}작은 농장이 자라나요
          </Text>

          <View style={styles.guideContainer}>
            <Text style={styles.guideText}>· 작물을 고르면 바로 시작돼요</Text>
            <Text style={styles.guideText}>· 중간에 멈춰도 씨앗으로 남아요</Text>
            <Text style={styles.guideText}>· 기록은 서버에 저장돼요</Text>
          </View>

          <View style={styles.noticeContainer}>
            <Text style={styles.notice}>집중농장은 치료 서비스가 아니에요.</Text>
            <Text style={styles.notice}>많이 힘들 땐 자살예방 상담전화 109로 연락하세요.</Text>
          </View>

          <PrimaryButton
            title="시작하기"
            onPress={() => navigation.navigate('S02')}
          />
        </BottomCardModal>
      </SafeAreaView>
    </View>
  );
}

// S01Screen에는 컴포넌트 배치/레이아웃(위치) 잡는 최소한의 껍데기 스타일만 남김
const styles = StyleSheet.create({
  farmBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  topSpacer: {
    flex: 1.2,
  },
  titleText: {
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 20,
    color: COLORS.black,
  },
  guideContainer: {
    width: '100%',
    backgroundColor: COLORS.Graycontainer,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  guideText: {
    fontSize: FONTS.size.body - 2,
    color: COLORS.black,
    fontWeight: FONTS.weight.medium,
  },
  noticeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  notice: {
    fontSize: FONTS.size.caption,
    color: COLORS.notice,
    textAlign: 'center',
    lineHeight: 16,
  },
});