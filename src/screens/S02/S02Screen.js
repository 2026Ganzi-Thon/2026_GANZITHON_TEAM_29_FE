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

export default function InitialFarmScreen({ navigation }) {
  const [currentTime, setCurrentTime] = useState('9:41');
  const [selectedPlot, setSelectedPlot] = useState(null);

  // 12개 밭 모두 빈 상태(empty)로 초기화
  const [plotsData] = useState(() => 
    Array.from({ length: 12 }, (_, index) => ({
      id: index,
      plotIndex: index,
      farmStatus: 'empty',
      cropName: null,
      stage: 0,
    }))
  );

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTime(`${hours}:${formattedMinutes}`);
    };
    updateCurrentTime();
  }, []);

  // 빈 밭을 누르면 작물 심기 화면(S04 또는 S05)으로 이동
  const handleSelectPlot = (plotIndex) => {
    setSelectedPlot(plotIndex);
    setTimeout(() => {
      navigation.navigate('S04', { plotIndex: plotIndex });
    }, 150);
  };

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D 
          cameraPos={[0, 6.0, 7.0]} 
          modelOffsetY={-0.5} 
          plotsData={plotsData}
          selectedPlotIndex={selectedPlot}
          onSelectPlot={handleSelectPlot}
        />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View style={styles.topCardWrapper}>
          <TopHeaderCard>
            <Text style={styles.timeText}>{currentTime}</Text>

            <View style={styles.headerTopRow}>
              <Text style={styles.brandTitle}>집중농장</Text>
              <Pressable onPress={() => navigation.navigate('S14')}>
                <Text style={styles.recordText}>기록</Text>
              </Pressable>
            </View>

            <Text style={[commonStyles.title, styles.mainTitle]}>
              첫 씨앗을{'\n'}심어볼까요?
            </Text>

            <View style={styles.subTextContainer}>
              <Text style={styles.subMessage}>10분짜리 새싹채소부터 시작해도 좋아요</Text>
            </View>
          </TopHeaderCard>
        </View>

        <View style={styles.middleSpacer} pointerEvents="none" />

        {/* 하단 토스트 메시지 */}
        <BottomNoticeToast 
          message="빈 밭을 누르면 작물을 고를 수 있어요" 
          style={styles.toastStyle} 
          onPress={() => handleSelectPlot(0)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  farmBackground: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%', zIndex: 0,
  },
  container: { 
    flex: 1, 
    zIndex: 1, 
    justifyContent: 'space-between', 
    backgroundColor: 'transparent' 
  },
  topCardWrapper: { 
    paddingHorizontal: 12, 
    marginTop: 8 
  },
  timeText: { 
    fontSize: FONTS.size.body - 1, 
    color: COLORS.black, 
    fontWeight: FONTS.weight.medium, 
    marginBottom: 20 
  },
  headerTopRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  brandTitle: { 
    fontSize: FONTS.size.title - 2, 
    fontWeight: FONTS.weight.bold, 
    color: COLORS.black 
  },
  recordText: { 
    fontSize: FONTS.size.body, 
    color: COLORS.graytext, 
    fontWeight: FONTS.weight.medium 
  },
  mainTitle: { 
    fontSize: FONTS.size.title + 2, 
    fontWeight: FONTS.weight.bold, 
    color: COLORS.black, 
    lineHeight: 34, 
    marginBottom: 12 
  },
  subTextContainer: {
    paddingBottom: 4,
  },
  subMessage: { 
    fontSize: FONTS.size.body - 1, 
    color: COLORS.graytext, 
    fontWeight: FONTS.weight.medium 
  },
  middleSpacer: { 
    flex: 1 
  },
  toastStyle: { 
    marginBottom: 40 
  },
});