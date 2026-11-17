import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../styles/colors';
import FarmScene3D from '../farm/FarmScene3D';

// 디자인 시안의 잔디 색. 3D 배경도 이 색으로 채워서 농장 바깥이 베이지색으로 안 보이게 함
const GRASS_HEX = 0xacd066;
const GRASS = '#ACD066';

// 디자인 구도: 농장이 화면 가로를 꽉 채우고, 위에서 비스듬히 내려다보는 느낌
// 폰에서 보고 더 확대하고 싶으면 FARM_VISIBLE_WIDTH를 줄이고, 더 위에서 보고 싶으면 FARM_CAMERA_ANGLE을 키우기
const FARM_VISIBLE_WIDTH = 2.9;
const FARM_CAMERA_ANGLE = 50;

/**
 * 위에는 3D 농장, 아래에는 흰색 시트가 올라오는 공통 화면 틀
 * (S10, S11, S12, S14~S19처럼 "3D 농장 + 아래 시트" 구조인 화면에서 사용)
 *
 * 사용법:
 *   <FarmSheetLayout>
 *     ...시트 안에 들어갈 내용...
 *   </FarmSheetLayout>
 *
 * farmArea: 기본 농장 대신 다른 3D 장면(수확 연출, 물 주기 연출 등)을 넣고 싶을 때 사용
 */
export default function FarmSheetLayout({ children, farmArea }) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.farmArea}>
        {farmArea ?? (
          <FarmScene3D
            backgroundColor={GRASS_HEX}
            visibleWidth={FARM_VISIBLE_WIDTH}
            cameraAngle={FARM_CAMERA_ANGLE}
          />
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        {children}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRASS,
  },

  // 시트 위에 남는 공간 전체를 3D 농장이 채움
  farmArea: {
    flex: 1,
  },

  sheet: {
    marginTop: -28, // 시트가 농장 위로 살짝 겹쳐 올라오도록
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.white,
  },
});
