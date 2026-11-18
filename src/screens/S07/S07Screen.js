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

export default function S07Screen({ route, navigation }) {
  const { sessionId, plotIndex = 0 } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(route.params?.remainingSeconds || 0);
  const [plotsData, setPlotsData] = useState([]);
  const [currentCropName, setCurrentCropName] = useState('작물');

  useEffect(() => {
    fetchFarmState();
  }, []);

  const fetchFarmState = async () => {
    try {
      const { data: farmData } = await supabase.rpc('get_my_farm');
      
      // 💡 0 ~ 11 인덱스로 일치시켜 튕김 현상 방지
      const formattedPlots = Array.from({ length: 12 }, (_, index) => {
        const serverPlot = farmData?.find(item => item.plot_index === index);
        return {
          id: index,
          plotIndex: index,
          plotId: serverPlot?.plot_id || null,
          farmStatus: index === plotIndex ? 'paused' : (serverPlot?.farm_status || 'empty'),
          cropName: serverPlot?.crop_name || null,
          stage: serverPlot?.stage || 1,
        };
      });

      setPlotsData(formattedPlots);

      if (plotIndex !== undefined) {
        const targetPlot = farmData?.find(item => item.plot_index === plotIndex);
        if (targetPlot && targetPlot.crop_name) {
          setCurrentCropName(targetPlot.crop_name);
        }
      }
    } catch (error) {
      console.error('농장 상태 조회 실패:', error.message);
    }
  };

  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleResumeFocus = async () => {
    if (!sessionId) {
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.rpc('resume_focus', {
        p_session_id: sessionId,
      });

      if (error) throw error;

      navigation.replace('S06', { plotIndex, sessionId });
    } catch (error) {
      console.error('집중 재개 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopPreview = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('preview_stop_focus', {
        p_session_id: sessionId,
      });

      if (error) throw error;

      navigation.navigate('S09', { previewData: data, sessionId, plotIndex });
    } catch (error) {
      console.error('중도 종료 미리보기 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D 
          cameraPos={[0, 5.0, 5.8]} 
          modelOffsetY={0.4} 
          plotsData={plotsData}
          selectedPlotIndex={plotIndex}
        />
        <View style={styles.pausedOverlay} />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View style={styles.topSpacer} />

        <View style={styles.bottomSheet}>
          <Text style={styles.title}>{currentCropName} 키우는 중</Text>
          <Text style={styles.subMainTitle}>작물도 잠깐 쉬고 있어요</Text>
          <Text style={styles.subtitle}>
            남은 시간 {formatTime(remainingSeconds)} · 멈춤
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={COLORS.black} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Pressable style={styles.resumeButton} onPress={handleResumeFocus}>
                <Text style={styles.resumeButtonText}>이어하기</Text>
              </Pressable>

              <Pressable onPress={handleStopPreview} style={styles.stopTextButton}>
                <Text style={styles.stopText}>오늘은 여기까지</Text>
              </Pressable>
            </>
          )}
        </View>
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
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1,
  },
  container: {
    flex: 1,
    zIndex: 2,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  topSpacer: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: COLORS.white || '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: {
    fontSize: FONTS.size.body,
    color: COLORS.graytext,
    marginBottom: 4,
  },
  subMainTitle: {
    fontSize: FONTS.size.title || 20,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    marginBottom: 24,
  },
  resumeButton: {
    width: '100%',
    backgroundColor: COLORS.black || '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  resumeButtonText: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.white,
  },
  stopTextButton: {
    padding: 8,
  },
  stopText: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    textDecorationLine: 'underline',
  },
});