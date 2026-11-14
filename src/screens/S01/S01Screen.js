
import React from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
} from 'react-native';

import FarmScene3D from '../../components/farm/FarmScene3D';
import { styles } from './S01Styles';

export default function S01Screen({ navigation }) {
  const handleStart = () => {
    navigation.navigate('S02');
  };

  return (
    <View style={styles.container}>
      {/* 3D 농장 배경 */}
      <FarmScene3D />

      {/* 안내 내용 */}
      <SafeAreaView style={styles.content}>
        <View style={styles.message}>
          <Text style={styles.title}>
            집중한 만큼,{'\n'}
            작은 농장이 자라요
          </Text>

          <View style={styles.guideList}>
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

        <View style={styles.bottom}>
          <Text style={styles.notice}>
            집중농장은 치료 서비스가 아니에요.
          </Text>
          <Text style={styles.notice}>
            많이 힘들 땐 자살예방 상담전화 109로 연락하세요.
          </Text>

          <Pressable
            style={styles.startButton}
            onPress={handleStart}
          >
            <Text style={styles.buttonText}>시작하기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
