import React, { useState, useEffect } from 'react';
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

import FarmScene3D from '../../components/farm/FarmScene3D';
import TopHeaderCard from '../../components/common/TopHeaderCard';
import BottomNoticeToast from '../../components/common/BottomNoticeToast';

export default function S03Screen({ navigation }) {
  const [currentTime, setCurrentTime] = useState('');
  const [selectedPlot, setSelectedPlot] = useState(null);
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

  useEffect(() => {
    fetchMyFarmData();
  }, []);

  const fetchMyFarmData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_my_farm');
      if (error) throw error;

      const formattedPlots = Array.from({ length: 12 }, (_, index) => {
        const plotIndex = index + 1;
        const serverPlot = data?.find(item => item.plot_index === plotIndex);

        return {
          id: plotIndex,
          plotId: serverPlot?.plot_id || null,
          farmStatus: serverPlot?.farm_status || 'empty',
          sessionId: serverPlot?.session_id || null,
          sessionStatus: serverPlot?.session_status || null,
          cropId: serverPlot?.crop_id || null,
          cropName: serverPlot?.crop_name || null,
          targetSeconds: serverPlot?.target_seconds || null,
          harvestId: serverPlot?.harvest_id || null,
          isAutoHarvest: serverPlot?.is_auto_harvest || false,
          focusedSeconds: serverPlot?.focused_seconds || 0,
        };
      });

      setPlotsData(formattedPlots);


      let calculatedSeconds = 0;
      let calculatedHarvests = 0;

      data?.forEach(item => {

        if (item.focused_seconds) {
          calculatedSeconds += item.focused_seconds;
        }
        if (item.farmStatus === 'harvested' || item.harvest_id || item.status === 'harvested') {
          calculatedHarvests += 1;
        }
      });

      setTodayStats({
        totalSeconds: calculatedSeconds,
        harvestCount: calculatedHarvests,
      });

      const unacknowledgedHarvestIds = data
        ?.filter(item => item.is_auto_harvest && !item.acknowledged && item.harvest_id)
        .map(item => item.harvest_id);

      if (unacknowledgedHarvestIds && unacknowledgedHarvestIds.length > 0) {
        await supabase.rpc('ack_auto_harvest_notice', { p_harvest_ids: unacknowledgedHarvestIds });
      }

    } catch (error) {
      console.error('S03 데이터 초기화 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlot = (index) => {
    setSelectedPlot(index); 

    const targetPlot = plotsData[index];
    if (!targetPlot || targetPlot.farmStatus === 'empty') {
      setTimeout(() => {
        navigation.navigate('S04', { plotIndex: index + 1 });
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
          cameraPos={[0, 5.0, 5.8]} 
          modelOffsetY={0.4} 
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