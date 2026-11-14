
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
      <View style={styles.farmBackground}>
        <FarmScene3D />
      </View>

      <SafeAreaView
        style={styles.content}
        pointerEvents="box-none"
      >
        <View style={styles.messageContainer}>
          <Text style={styles.title}>
            집중한 만큼,{'\n'}작은 농장이 자라요
          </Text>

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
        </View>

        <View style={styles.bottomContainer}>
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

  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },

  messageContainer: {
    marginTop: 100,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.black,
    lineHeight: 36,
  },

  guideContainer: {
    marginTop: 24,
    gap: 10,
  },

  guideText: {
    fontSize: 14,
    color: COLORS.graytext,
  },

  bottomContainer: {
    paddingBottom: 20,
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
    marginBottom: 5,
  },

  startButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.black,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
