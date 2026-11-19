import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { commonStyles } from '../../styles/commonStyles';
import { supabase } from '../../utils/supabase';

import FarmScene3D from '../../components/farm/FarmScene3D';

function calculateStageFromProgress(progressValue) {
  if (progressValue >= 80) return 5;
  if (progressValue >= 60) return 4;
  if (progressValue >= 40) return 3;
  if (progressValue >= 20) return 2;
  return 1;
}

function calculateProgressFromTimes(remSec, targetSec) {
  const validTarget = Number(targetSec) || 0;
  if (validTarget <= 0) return 0;
  const safeRem = Math.max(0, Math.min(validTarget, Number(remSec) || 0));
  const elapsed = validTarget - safeRem;
  return Math.min(Math.max(Math.floor((elapsed / validTarget) * 100), 0), 100);
}

function resolveRemainingSeconds(sessionObj, fallbackSeconds = 0) {
  if (!sessionObj) return Math.max(0, Math.round(Number(fallbackSeconds) || 0));

  const endField = sessionObj.ends_at || sessionObj.expires_at || sessionObj.end_at;
  if (endField) {
    const endMs = new Date(endField).getTime();
    if (!Number.isNaN(endMs)) {
      return Math.max(0, Math.round((endMs - Date.now()) / 1000));
    }
  }

  const targetSec = Number(sessionObj.target_seconds || fallbackSeconds || 0);
  if (sessionObj.started_at && targetSec > 0) {
    const startMs = new Date(sessionObj.started_at).getTime();
    if (!Number.isNaN(startMs)) {
      const elapsedSec = Math.round((Date.now() - startMs) / 1000);
      return Math.max(0, targetSec - elapsedSec);
    }
  }

  if (sessionObj.remaining_seconds !== undefined && sessionObj.remaining_seconds !== null) {
    return Math.max(0, Math.round(Number(sessionObj.remaining_seconds)));
  }

  return Math.max(0, Math.round(Number(fallbackSeconds) || 0));
}

export default function S07Screen({ route, navigation }) {
  const {
    sessionId,
    plotIndex = 0,
    cropId,
    cropName,
    targetSeconds: routeTargetSeconds,
  } = route.params || {};
  const isServerSession = !!sessionId && !String(sessionId).startsWith('local_');

  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    route.params?.remainingSeconds !== undefined
      ? Math.max(0, Math.round(Number(route.params.remainingSeconds)))
      : 0
  );
  const [targetSeconds, setTargetSeconds] = useState(
    routeTargetSeconds ? Math.max(1, Number(routeTargetSeconds)) : 0
  );
  const [plotsData, setPlotsData] = useState([]);
  const [currentCropName, setCurrentCropName] = useState(cropName || '작물');

  useEffect(() => {
    fetchFarmState();
  }, []);

  const buildPlots = (farmData, remSec, tSec, activeCrop) => {
    const progress = calculateProgressFromTimes(remSec, tSec);
    const activeStage = calculateStageFromProgress(progress);

    return Array.from({ length: 12 }, (_, index) => {
      const serverPlot = farmData?.find(item => item.plot_index === index + 1);
      const isCurrentPausedPlot = index === plotIndex;

      return {
        id: index,
        plotIndex: index,
        plotId: serverPlot?.plot_id || null,
        farmStatus: isCurrentPausedPlot ? 'paused' : (serverPlot?.farm_status || 'empty'),
        cropName: isCurrentPausedPlot
          ? (serverPlot?.crop_name || activeCrop || cropName || null)
          : (serverPlot?.crop_name || null),
        stage: isCurrentPausedPlot
          ? activeStage
          : (serverPlot?.farm_status === 'ripe' ? 5 : 1),
      };
    });
  };

  const fetchFarmState = async () => {
    try {
      const { data: farmData } = await supabase.rpc('get_my_farm');

      let resolvedCropName = cropName || '작물';
      if (plotIndex !== undefined) {
        const targetPlot = farmData?.find(item => item.plot_index === plotIndex + 1);
        if (targetPlot && targetPlot.crop_name) {
          resolvedCropName = targetPlot.crop_name;
          setCurrentCropName(targetPlot.crop_name);
        }
      }

      let syncedSeconds =
        route.params?.remainingSeconds !== undefined
          ? Math.max(0, Math.round(Number(route.params.remainingSeconds)))
          : remainingSeconds;
      let syncedTarget = routeTargetSeconds
        ? Math.max(1, Number(routeTargetSeconds))
        : targetSeconds;

      if (isServerSession) {
        const { data } = await supabase.rpc('get_active_focus');
        const activeSession = data?.session ?? data ?? null;
        if (activeSession) {
          if (activeSession.target_seconds) {
            syncedTarget = Math.max(1, Number(activeSession.target_seconds));
            setTargetSeconds(syncedTarget);
          }
          syncedSeconds = resolveRemainingSeconds(activeSession, syncedSeconds);
          setRemainingSeconds(syncedSeconds);
        }
      }

      // targetSeconds가 아직 없는데 route에 있으면 반영
      if (!syncedTarget && routeTargetSeconds) {
        syncedTarget = Math.max(1, Number(routeTargetSeconds));
        setTargetSeconds(syncedTarget);
      }

      setPlotsData(buildPlots(farmData, syncedSeconds, syncedTarget, resolvedCropName));
    } catch (error) {
      console.error('농장 상태 조회 실패:', error.message);
    }
  };

  // remainingSeconds나 targetSeconds가 갱신될 때 현재 밭의 stage도 S06과 동일하게 동기화
  useEffect(() => {
    if (plotsData.length === 0) return;
    const progress = calculateProgressFromTimes(remainingSeconds, targetSeconds);
    const activeStage = calculateStageFromProgress(progress);

    setPlotsData(prev =>
      prev.map(p =>
        p.plotIndex === plotIndex && p.stage !== activeStage
          ? { ...p, stage: activeStage }
          : p
      )
    );
  }, [remainingSeconds, targetSeconds, plotIndex]);

  const formatTime = (secs) => {
    const safeSecs = Math.max(0, Math.round(Number(secs) || 0));
    const minutes = Math.floor(safeSecs / 60);
    const seconds = safeSecs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleResumeFocus = async () => {
    const resumeParams = {
      plotIndex,
      sessionId,
      cropId,
      cropName: currentCropName,
      targetSeconds: targetSeconds || routeTargetSeconds,
      remainingSeconds,
      fromPause: true,
    };

    if (!isServerSession) {
      navigation.replace('S06', resumeParams);
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.rpc('resume_focus', {
        p_session_id: sessionId,
      });

      if (error) throw error;

      navigation.replace('S06', resumeParams);
    } catch (error) {
      console.error('집중 재개 실패:', error.message);
      navigation.replace('S06', resumeParams);
    } finally {
      setLoading(false);
    }
  };

  const handleStopPreview = async () => {
    if (!isServerSession) {
      navigation.navigate('S09', { sessionId, plotIndex });
      return;
    }

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
          cameraPos={[0, 6, 7]}
          modelOffsetY={0.5}
          plotsData={plotsData}
          selectedPlotIndex={plotIndex}
          blurred={true}
        />
        <BlurView
          intensity={80}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={styles.blurLayer}
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
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    zIndex: 2,
  },
  container: {
    flex: 1,
    zIndex: 3,
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
    alignSelf: 'flex-start',
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.medium,
    color: COLORS.black,
    marginBottom: 14,
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