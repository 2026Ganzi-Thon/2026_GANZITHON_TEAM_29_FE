import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';
import { supabase } from '../../utils/supabase';
import { formatMinutes } from '../../utils/time';

// - [쉬어가기] → 키우던 작물을 일시정지하고 S11 (물 주며 쉬기)
// - [계속하기] → 창 닫고 S06으로 돌아가기
export default function S12Screen({ navigation, route }) {
  // S06에서 넘겨준 정보 (minutes: 쉬지 않고 키운 시간(분), 없으면 개발용 기본값)
  const { minutes = 90, sessionId, plotIndex } = route.params ?? {};
  const [loading, setLoading] = useState(false);

  const continueFocus = () => {
    if (loading) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('S06');
  };

  const rest = async () => {
    if (loading) return;
    setLoading(true);

    // 쉬는 동안 작물이 자라지 않도록 일시정지 (다 쉬면 S11에서 다시 재개)
    if (sessionId && !String(sessionId).startsWith('local_')) {
      const { error } = await supabase.rpc('pause_focus', { p_session_id: sessionId });
      if (error) console.log('쉬어가기 일시정지 실패:', error.message);
    }

    // S06 위에 S11을 올려 두고, 다 쉬면 S06으로 돌아감
    navigation.replace('S11', { focusRest: true, sessionId, plotIndex });
  };

  return (
    <FarmSheetLayout>
      {/* 기본 프로필 그림 */}
      <View style={styles.avatar}>
        <Ionicons name="person" size={78} color="#FFFFFF" style={styles.avatarIcon} />
      </View>

      <Text style={styles.title}>{'농부도 쉬어야\n작물이 잘 자라요'}</Text>
      <Text style={styles.subtitle}>
        벌써 {formatMinutes(minutes)}째 쉬지 않고 키웠어요
      </Text>

      <AppButton
        title="쉬어가기"
        onPress={rest}
        disabled={loading}
        style={styles.restButton}
      />
      <AppButton title="계속하기" variant="outline" onPress={continueFocus} disabled={loading} />
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 38,
    backgroundColor: '#B9CBDC',
  },

  avatarIcon: {
    marginBottom: -10,
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
