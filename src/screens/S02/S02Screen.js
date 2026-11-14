import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { commonStyles } from '../../styles/commonStyles';

// 3D 뷰어 (S02에 맞는 구도로 props 조절 가능)
import FarmScene3D from '../../components/farm/FarmScene3D';

// 공용 컴포넌트
import TopHeaderCard from '../../components/common/TopHeaderCard';
import BottomNoticeToast from '../../components/common/BottomNoticeToast';

export default function S02Screen({ navigation }) {
  return (
    <View style={commonStyles.screen}>
      {/* 3D 농장 배경 (S02 구도에 맞춰 카메라/모델 위치 조절 가능) */}
      <View style={styles.farmBackground}>
        <FarmScene3D 
          cameraPos={[0, 5.0, 5.8]} 
          modelOffsetY={0.4} 
        />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        {/* 상단 불투명 박스 공용 컴포넌트 */}
        <TopHeaderCard>
          <View style={styles.headerTopRow}>
            <Text style={styles.brandTitle}>집중농장</Text>
            <Pressable onPress={() => navigation.navigate('Record')}>
              <Text style={styles.recordText}>기록</Text>
            </Pressable>
          </View>

          <Text style={[commonStyles.title, styles.mainTitle]}>
            첫 씨앗을{'\n'}심어볼까요?
          </Text>

          <Text style={styles.subText}>
            10분짜리 새싹채소부터 시작해도 좋아요
          </Text>
        </TopHeaderCard>

        {/* 중간 3D 영역 공간 (터치 통과) */}
        <View style={styles.middleSpacer} pointerEvents="none" />

        {/* 하단 까만 안내 문구 박스 공용 컴포넌트 */}
        <BottomNoticeToast message="빈 밭을 누르면 작물을 고를 수 있어요" />
      </SafeAreaView>
    </View>
  );
}

// S02Screen에는 레이아웃 배치 껍데기 스타일만 최소한으로 작성
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
  container: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
  },
  recordText: {
    fontSize: FONTS.size.body,
    color: COLORS.graytext,
  },
  mainTitle: {
    fontSize: FONTS.size.title + 2,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    lineHeight: 32,
    marginBottom: 8,
  },
  subText: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
  },
  middleSpacer: {
    flex: 1,
  },
});