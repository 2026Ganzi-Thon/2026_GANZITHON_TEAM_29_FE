import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { commonStyles } from '../../styles/commonStyles';
import { supabase } from '../../utils/supabase';
import { fetchHistory } from '../../lib/records';

import FarmScene3D from '../../components/farm/FarmScene3D';
import TopHeaderCard from '../../components/common/TopHeaderCard';
import BottomNoticeToast from '../../components/common/BottomNoticeToast';

export default function S03Screen({ navigation }) {
  const [currentTime, setCurrentTime] = useState('');
  const [selectedPlot, setSelectedPlot] = useState(null); // 0~11 인덱스
  const [plotsData, setPlotsData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [todayStats, setTodayStats] = useState({
    totalSeconds: 0,
    harvestCount: 0,
  });

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

  const DEFAULT_NOTICE = '빈 밭을 눌러 씨앗을 심어요';
  const [notice, setNotice] = useState(DEFAULT_NOTICE);

  // 다른 화면에서 돌아올 때마다 농장 상태를 다시 불러옴
  useFocusEffect(
    useCallback(() => {
      setSelectedPlot(null);
      setNotice(DEFAULT_NOTICE);
      fetchMyFarmData();
    }, [])
  );

  useEffect(() => {
    if (notice === DEFAULT_NOTICE) return;
    const timer = setTimeout(() => setNotice(DEFAULT_NOTICE), 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  const fetchMyFarmData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_my_farm');

      const farmList = error ? [] : (data || []);

      const formattedPlots = Array.from({ length: 12 }, (_, index) => {
        // 앱은 0 ~ 11, 서버 plot_index는 1 ~ 12
        const plotIndex = index;
        const serverPlot = farmList.find(item => item.plot_index === plotIndex + 1);

        return {
          id: plotIndex,
          plotIndex: plotIndex, // 0 ~ 11 통일
          plotId: serverPlot?.plot_id || `mock_plot_id_${plotIndex}`,
          farmStatus: serverPlot?.farm_status || 'empty',
          sessionId: serverPlot?.session_id || null,
          sessionStatus: serverPlot?.session_status || null,
          cropId: serverPlot?.crop_id || null,
          cropName: serverPlot?.crop_name || null,
          targetSeconds: serverPlot?.target_seconds || null,
          harvestId: serverPlot?.harvest_id || null,
          isAutoHarvest: serverPlot?.is_auto_harvest || false,
          focusedSeconds: serverPlot?.focused_seconds || 0,
          stage: serverPlot?.farm_status === 'ripe' ? 5 : 1,
        };
      });

      setPlotsData(formattedPlots);

      // 오늘 키운 시간·수확 수는 기록 API에서 가져옴 (get_my_farm에는 없음)
      try {
        const today = await fetchHistory('today');
        setTodayStats({
          totalSeconds: today?.summary?.focused_seconds || 0,
          harvestCount: today?.summary?.harvest_count || 0,
        });
      } catch (e) {
        console.log('오늘 기록 조회 실패:', e?.code);
      }

      const unacknowledgedHarvestIds = farmList
        ?.filter(item => item.is_auto_harvest && !item.acknowledged && item.harvest_id)
        .map(item => item.harvest_id);

      if (unacknowledgedHarvestIds && unacknowledgedHarvestIds.length > 0) {
        await supabase.rpc('ack_auto_harvest_notice', { p_harvest_ids: unacknowledgedHarvestIds }).catch(() => {});
      }

    } catch (error) {
      console.error('S03 데이터 초기화 실패:', error.message);

      const fallbackPlots = Array.from({ length: 12 }, (_, index) => ({
        id: index,
        plotIndex: index,
        farmStatus: 'empty',
        cropName: null,
        stage: 0,
      }));
      setPlotsData(fallbackPlots);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlot = (plotIndex) => {
    // 💡 [핵심] 누른 밭 인덱스(0~11)를 하이라이트와 네비게이션 전달값으로 100% 동일하게 사용
    setSelectedPlot(plotIndex);

    const targetPlot = plotsData.find(p => p.plotIndex === plotIndex);

    // 실제로 진행 중인 세션이 있을 때만 빈 밭 새 파종 차단 (다 키운 'ripe' 밭은 허용)
    const hasActiveSession = plotsData.some(
      p =>
        p.farmStatus === 'growing' &&
        (p.sessionStatus === 'active' || p.sessionStatus === 'paused')
    );

    if ((!targetPlot || targetPlot.farmStatus === 'empty') && hasActiveSession) {
      setSelectedPlot(null);
      setNotice('한 번에 하나만 키울 수 있어요');
      return;
    }

    if (!targetPlot || targetPlot.farmStatus === 'empty') {
      setTimeout(() => {
        navigation.navigate('S04', { plotIndex: plotIndex });
      }, 150);
    } else if (targetPlot.farmStatus === 'ripe') {
      setTimeout(() => {
        navigation.navigate('S17', {
          cropName: targetPlot.cropName || '작물',
          minutes: Math.round((targetPlot.targetSeconds || 1200) / 60),
          plotIndex: plotIndex,
          sessionId: targetPlot.sessionId,
        });
      }, 150);
    } else if (targetPlot.farmStatus === 'growing' || targetPlot.sessionStatus === 'paused') {
      setTimeout(() => {
        navigation.navigate('S06', {
          plotIndex: plotIndex,
          cropId: targetPlot.cropId,
          sessionId: targetPlot.sessionId,
          cropName: targetPlot.cropName,
        });
      }, 150);
    }
  };

  const formatMinutes = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}분`;
  };

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D
          cameraPos={[0, 6.0, 7.0]}
          modelOffsetY={-0.7}
          plotsData={plotsData}
          selectedPlotIndex={selectedPlot}
          onSelectPlot={handleSelectPlot}
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
              <Text style={styles.statsValue}>
                {formatMinutes(todayStats.totalSeconds)} · 수확 {todayStats.harvestCount}개
              </Text>
            </View>
          </TopHeaderCard>
        </View>

        <View style={styles.middleSpacer} pointerEvents="none" />

        <BottomNoticeToast
          message={notice}
          style={styles.toastStyle}
          onPress={() => {
            const firstEmpty = plotsData.find(p => p.farmStatus === 'empty');
            const targetPlotIndex = firstEmpty ? firstEmpty.plotIndex : 0;
            handleSelectPlot(targetPlotIndex);
          }}
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