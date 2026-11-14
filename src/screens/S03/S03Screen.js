import React, { useState, useEffect } from 'react';
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

import FarmScene3D from '../../components/farm/FarmScene3D';
import TopHeaderCard from '../../components/common/TopHeaderCard';
import BottomNoticeToast from '../../components/common/BottomNoticeToast';

export default function S03Screen({ navigation }) {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTime(`${hours}:${formattedMinutes}`);
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D 
          cameraPos={[0, 5.0, 5.8]} 
          modelOffsetY={0.4} 
        />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View style={styles.topCardWrapper}>
          <TopHeaderCard>
            <Text style={styles.timeText}>{currentTime || '9:41'}</Text>

            <View style={styles.headerTopRow}>
              <Text style={styles.brandTitle}>집중농장</Text>
              <Pressable onPress={() => navigation.navigate('S14')}>
                <Text style={styles.recordText}>기록</Text>
              </Pressable>
            </View>

            <Text style={[commonStyles.title, styles.mainTitle]}>
              오늘은 무엇을{'\n'}키워볼까요?
            </Text>

            <View style={styles.statsContainer}>
              <Text style={styles.statsLabel}>오늘 키운 시간</Text>
              <Text style={styles.statsValue}>10분 · 수확 1개</Text>
            </View>
          </TopHeaderCard>
        </View>

        <View style={styles.middleSpacer} pointerEvents="none" />

        <BottomNoticeToast 
          message="빈 밭을 눌러 씨앗을 심어요" 
          style={styles.toastStyle} 
        />
      </SafeAreaView>
    </View>
  );
}

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
  topCardWrapper: {
    paddingHorizontal: 12,
    marginTop: 8,
  },
  timeText: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.black,
    fontWeight: FONTS.weight.medium,
    marginBottom: 20, 
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20, 
  },
  brandTitle: {
    fontSize: FONTS.size.title - 2,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
  },
  recordText: {
    fontSize: FONTS.size.body,
    color: COLORS.graytext,
    fontWeight: FONTS.weight.medium,
  },
  mainTitle: {
    fontSize: FONTS.size.title + 2,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    lineHeight: 34,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.Graycontainer,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statsLabel: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    fontWeight: FONTS.weight.medium,
  },
  statsValue: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.black,
    fontWeight: FONTS.weight.bold,
  },
  middleSpacer: {
    flex: 1,
  },
  toastStyle: {
    marginBottom: 40,
  },
});