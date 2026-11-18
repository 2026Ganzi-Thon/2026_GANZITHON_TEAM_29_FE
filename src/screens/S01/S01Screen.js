import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../styles/colors';
import FarmScene3D from '../../components/farm/FarmScene3D';

export default function S01Screen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* 3D 배경에 cameraPos와 modelOffsetY 전달 */}
      <View style={styles.farmBackground}>
        <FarmScene3D 

          modelOffsetY={1.3} 
        />
      </View>

      {/* 하단 시트 영역 */}
      <SafeAreaView
        style={styles.bottomSheetArea}
        pointerEvents="box-none"
      >
        <View style={styles.bottomSheet}>
          {/* 타이틀 */}
          <Text style={styles.title}>
            집중한 만큼,{'\n'}작은 농장이 자라요
          </Text>

          {/* 안내 박스 */}
          <View style={styles.guideContainer}>
            <Text style={styles.guideText}>
              · 작물을 고르면 바로 시작돼요
            </Text>
            <Text style={styles.guideText}>
              · 중간에 멈춰도 씨앗으로 남아요
            </Text>
            <Text style={styles.guideText}>
              · 기록은 서버에 저장돼요
            </Text>
          </View>

          {/* 하단 고지 및 버튼 영역 */}
          <View style={styles.footerContainer}>
            <View style={styles.noticeContainer}>
              <Text style={styles.notice}>
                집중농장은 치료 서비스가 아니에요.
              </Text>
              <Text style={styles.notice}>
                많이 힘들 땐 자살예방 상담전화 109로 연락하세요.
              </Text>
            </View>

            <Pressable
              style={styles.startButton}
              onPress={() => navigation.navigate('S02')}
            >
              <Text style={styles.buttonText}>시작하기</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#EEEEEE',
  },

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

  bottomSheetArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    justifyContent: 'flex-end',
  },

  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.black,
    lineHeight: 34,
    textAlign: 'center',
  },

  guideContainer: {
    marginTop: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },

  guideText: {
    fontSize: 13,
    color: COLORS.graytext,
  },

  footerContainer: {
    marginTop: 24,
    alignItems: 'center',
  },

  noticeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },

  notice: {
    fontSize: 11,
    color: COLORS.graytext,
    textAlign: 'center',
    marginBottom: 3,
  },

  startButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.black,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});