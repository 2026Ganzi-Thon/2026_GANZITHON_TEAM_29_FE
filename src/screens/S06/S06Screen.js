import React, { useState, useEffect, useRef } from 'react';
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
import { iGa } from '../../utils/josa';

import FarmScene3D from '../../components/farm/FarmScene3D';

export default function S06Screen({ route, navigation }) {
  // 💡 S05에서 넘어온 targetSeconds 또는 cropId에 따른 기본 시간 확보
  const { plotIndex = 0, cropId, cropName = '당근', targetSeconds: routeTargetSeconds } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [targetSeconds, setTargetSeconds] = useState(routeTargetSeconds || 600);
  const [remainingSeconds, setRemainingSeconds] = useState(routeTargetSeconds || 600);
  const [plotsData, setPlotsData] = useState([]);
  const [currentCropName, setCurrentCropName] = useState(cropName);

  const timerRef = useRef(null);

  useEffect(() => {
    initFocusSession();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const initFocusSession = async () => {
    try {
      setLoading(true);

      let currentSession = null;
      let activeError = null;

      try {
        const res = await supabase.rpc('get_active_focus');
        activeError = res.error;
        if (!activeError && res.data && res.data.session) {
          currentSession = res.data.session;
        }
      } catch (err) {
        activeError = err;
      }

      // 만약 활성 세션이 없으면 새로 start_focus 호출
      if (!currentSession) {
        let targetPlotId = null;
        try {
          const { data: farmDataForStart } = await supabase.rpc('get_my_farm');
          const targetPlot = farmDataForStart?.find(p => p.plot_index === plotIndex || p.id === plotIndex);
          targetPlotId = targetPlot?.plot_id;
        } catch (e) {
          // 무시
        }

        const validCropId = cropId || "10000000-0000-4000-8000-000000000002";
        const validPlotId = targetPlotId || "10d934b1-b15f-4144-8bc2-cd09eb22e251";

        try {
          const { data: startData, error: startError } = await supabase.rpc('start_focus', {
            p_plot_id: validPlotId,
            p_crop_id: validCropId,
          });

          if (!startError && startData) {
            currentSession = startData;
          }
        } catch (e) {
          // API 연동 전/실패 시 Mock 방어
        }

        if (!currentSession) {
          // 💡 S05에서 전달받은 routeTargetSeconds가 있다면 우선 반영, 없으면 기본 600초
          const defaultTarget = routeTargetSeconds || 600;
          currentSession = {
            session_id: "mock_session_id_123",
            target_seconds: defaultTarget,
            remaining_seconds: defaultTarget,
          };
        }
      }

      if (currentSession) {
        setSession(currentSession);
        
        // 💡 서버 세션에 기록된 target_seconds 또는 라우트로 전달받은 시간 반영
        const tSec = currentSession.target_seconds || routeTargetSeconds || 600;
        setTargetSeconds(tSec);

        const rSec = currentSession.remaining_seconds !== undefined && currentSession.remaining_seconds !== null
          ? currentSession.remaining_seconds
          : tSec;
        setRemainingSeconds(rSec);

        // 서버 세션에 저장된 작물 이름이 있다면 업데이트
        if (currentSession.crop_name) {
          setCurrentCropName(currentSession.crop_name);
        }
      }

      let farmData = [];
      try {
        const { data: fData } = await supabase.rpc('get_my_farm');
        farmData = fData || [];
      } catch (e) {
        // 무시
      }

      const currentProgress = calculateProgressForData(currentSession?.remaining_seconds, currentSession?.target_seconds || routeTargetSeconds || 600);
      let calculatedStage = 1;
      if (currentProgress >= 100) calculatedStage = 5;
      else if (currentProgress >= 80) calculatedStage = 4;
      else if (currentProgress >= 50) calculatedStage = 3;
      else if (currentProgress >= 20) calculatedStage = 2;
      else calculatedStage = 1;

      const formattedPlots = Array.from({ length: 12 }, (_, index) => {
        const isCurrentFocusPlot = index === plotIndex;
        const serverPlot = farmData?.find(item => item.plot_index === index || item.id === index);

        return {
          id: index,
          plotIndex: index,
          plotId: serverPlot?.plot_id || null,
          farmStatus: isCurrentFocusPlot ? 'growing' : (serverPlot?.farm_status || 'empty'),
          sessionStatus: isCurrentFocusPlot ? 'focusing' : (serverPlot?.session_status || null),
          cropId: isCurrentFocusPlot ? cropId : (serverPlot?.crop_id || null),
          cropName: isCurrentFocusPlot ? currentCropName : (serverPlot?.crop_name || null),
          stage: isCurrentFocusPlot ? calculatedStage : (serverPlot?.stage || 1),
        };
      });
      setPlotsData(formattedPlots);

    } catch (error) {
      console.error('집중 세션 초기화 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteFocus = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (session?.session_id && !session.session_id.startsWith('mock')) {
        await supabase.rpc('complete_focus', { p_session_id: session.session_id }).catch(() => {});
      }
    } catch (e) {
      console.log('complete_focus 호출 알림:', e?.message);
    }
    navigation.replace('S10', {
      cropName: currentCropName,
      minutes: Math.round(targetSeconds / 60) || 10,
      plotIndex,
    });
  };

  const calculateProgress = () => {
    if (!targetSeconds || targetSeconds === 0) return 0;
    const elapsed = targetSeconds - remainingSeconds;
    const progress = Math.floor((elapsed / targetSeconds) * 100);
    return Math.min(Math.max(progress, 0), 100);
  };

  const calculateProgressForData = (rem, target) => {
    const validTarget = target || 600;
    const elapsed = validTarget - (rem !== undefined ? rem : validTarget);
    const progress = Math.floor((elapsed / validTarget) * 100);
    return Math.min(Math.max(progress, 0), 100);
  };

  useEffect(() => {
    if (!session || remainingSeconds <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleCompleteFocus();
          return 0;
        }
        const nextSec = prev - 1;
        
        const updatedProgress = Math.min(Math.max(Math.floor(((targetSeconds - nextSec) / targetSeconds) * 100), 0), 100);
        let newStage = 1;
        if (updatedProgress >= 100) newStage = 5;
        else if (updatedProgress >= 80) newStage = 4;
        else if (updatedProgress >= 50) newStage = 3;
        else if (updatedProgress >= 20) newStage = 2;
        else newStage = 1;

        setPlotsData(prevPlots =>
          prevPlots.map(p => p.id === plotIndex ? { ...p, stage: newStage } : p)
        );

        return nextSec;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, targetSeconds, plotIndex]);

  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handlePauseFocus = async () => {
    if (!session?.session_id) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      let pausedRemaining = remainingSeconds;
      if (!session.session_id.startsWith('mock')) {
        const { data, error } = await supabase.rpc('pause_focus', {
          p_session_id: session.session_id,
        });
        if (error) throw error;
        pausedRemaining = data?.remaining_seconds !== undefined ? data.remaining_seconds : remainingSeconds;
      }

      navigation.navigate('S07', { 
        sessionId: session.session_id, 
        remainingSeconds: pausedRemaining, 
        plotIndex 
      });
    } catch (error) {
      console.error('일시정지 실패:', error.message);
    }
  };

  const handleStopPreview = async () => {
    if (!session?.session_id) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      let previewData = { focusSeconds: targetSeconds - remainingSeconds, focusMinutes: Math.floor((targetSeconds - remainingSeconds)/60), progress: calculateProgress(), result: 'SEED' };
      if (!session.session_id.startsWith('mock')) {
        const { data, error } = await supabase.rpc('preview_stop_focus', {
          p_session_id: session.session_id,
        });
        if (error) throw error;
        previewData = data;
      }

      navigation.navigate('S09', { previewData, sessionId: session.session_id, plotIndex });
    } catch (error) {
      console.error('중도 종료 미리보기 실패:', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.black} />
      </View>
    );
  }

  const progress = calculateProgress();

  let currentStageIndex = 0;
  if (progress >= 100) currentStageIndex = 4;
  else if (progress >= 80) currentStageIndex = 3;
  else if (progress >= 50) currentStageIndex = 2;
  else if (progress >= 20) currentStageIndex = 1;
  else currentStageIndex = 0;

  const stages = [
    { key: 'seed', label: '씨앗' },
    { key: 'sprout', label: '새싹' },
    { key: 'growth', label: '성장' },
    { key: 'fruit', label: '열매' },
    { key: 'harvest', label: '수확' },
  ];

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D 
          cameraPos={[0, 5.0, 5.8]} 
          modelOffsetY={0.4} 
          plotsData={plotsData}
          selectedPlotIndex={plotIndex !== undefined ? plotIndex : null}
        />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View style={styles.topSpacer} />

        <View style={styles.bottomSheet}>
          <Text style={styles.title}>{currentCropName} 키우는 중</Text>
          <Text style={styles.subtitle}>휴대폰을 세워두고 작물이 자라는 걸 지켜봐 주세요</Text>

          <View style={styles.stageContainer}>
            <View style={styles.stageDotsRow}>
              {stages.map((st, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;

                return (
                  <View key={st.key} style={styles.dotWrapper}>
                    <View
                      style={[
                        styles.stageDot,
                        isCompleted && styles.completedDot,
                        isCurrent && styles.activeDot,
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            <View style={styles.stageLabelsRow}>
              {stages.map((st, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;

                return (
                  <Text
                    key={st.key}
                    style={[
                      styles.stageText,
                      (isCompleted || isCurrent) && styles.activeStageText,
                      isCurrent && styles.currentStageText,
                    ]}
                  >
                    {st.label}
                  </Text>
                );
              })}
            </View>
          </View>

          <Text style={styles.timerTitle}>남은 시간 {formatTime(remainingSeconds)}</Text>

          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          <Text style={styles.progressDesc}>
            {iGa(currentCropName)} 쑥쑥 자라고 있어요 · {progress}%
          </Text>

          <Pressable style={styles.pauseButton} onPress={handlePauseFocus}>
            <Text style={styles.pauseButtonText}>잠깐 쉬기</Text>
          </Pressable>

          <Pressable onPress={handleStopPreview} style={styles.stopTextButton}>
            <Text style={styles.stopText}>오늘은 여기까지</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
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
  container: {
    flex: 1,
    zIndex: 1,
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
    fontSize: FONTS.size.title || 20,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    marginBottom: 20,
    textAlign: 'center',
  },
  stageContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  stageDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  dotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D1D1',
  },
  completedDot: {
    backgroundColor: '#1A1A1A',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A1A1A',
  },
  stageLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  stageText: {
    fontSize: FONTS.size.body - 2,
    color: '#A0A0A0',
    textAlign: 'center',
    flex: 1,
  },
  activeStageText: {
    color: '#1A1A1A',
  },
  currentStageText: {
    fontWeight: FONTS.weight.bold,
    color: '#1A1A1A',
  },
  timerTitle: {
    fontSize: 28,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 16,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#EAEAEA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.black || '#1A1A1A',
    borderRadius: 4,
  },
  progressDesc: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    marginBottom: 24,
  },
  pauseButton: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.black,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  pauseButtonText: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
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