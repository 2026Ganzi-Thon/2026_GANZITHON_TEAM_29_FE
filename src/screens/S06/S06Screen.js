import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { commonStyles } from '../../styles/commonStyles';
import { supabase } from '../../utils/supabase';
import { iGa } from '../../utils/josa';

import FarmScene3D from '../../components/farm/FarmScene3D';

// 테스트용 배속: 1초에 몇 초씩 줄일지 (발표·실사용 때는 1로)
// 1보다 크면 서버 시간과 맞추지 않고 앱 안에서만 빠르게 돌아감
const TEST_SPEED = 120;

export default function S06Screen({ route, navigation }) {
  const {
    plotIndex: routePlotIndex = 0,
    cropId,
    cropName,
    targetSeconds: routeTargetSeconds,
    remainingSeconds: routeRemainingSeconds,
    fromPause = false,
    isNewPlanting = false,
  } = route.params || {};
  const isFocused = useIsFocused();

  const [plotIndex, setPlotIndex] = useState(routePlotIndex);
  const firstLoadRef = useRef(true);

  const initialTarget = routeTargetSeconds || 600;
  const initialRemaining =
    routeRemainingSeconds !== undefined && routeRemainingSeconds !== null
      ? Math.max(0, Math.round(Number(routeRemainingSeconds)))
      : initialTarget;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [targetSeconds, setTargetSeconds] = useState(initialTarget);
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);

  const remainingRef = useRef(initialRemaining);
  const targetSecondsRef = useRef(initialTarget);
  const sessionRef = useRef(null);
  const isFocusedRef = useRef(isFocused);
  const lastSyncAnchorRef = useRef({
    syncedAtMs: Date.now(),
    remainingAtSync: initialRemaining,
  });

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isFocused]);

  useEffect(() => {
    remainingRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    targetSecondsRef.current = targetSeconds;
  }, [targetSeconds]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const [plotsData, setPlotsData] = useState([]);
  const [currentCropName, setCurrentCropName] = useState(cropName || '작물');

  const timerRef = useRef(null);
  const tickCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const isCompletingRef = useRef(false);
  const hasCheckedOverworkRef = useRef(false);

  useEffect(() => {
    if (isFocused) {
      initFocusSession();
    }
  }, [isFocused, routeRemainingSeconds, fromPause]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isMountedRef.current || !isFocusedRef.current) return;

      const currentSess = sessionRef.current;
      if (!currentSess) return;

      const elapsedSinceSync =
        Math.floor((Date.now() - lastSyncAnchorRef.current.syncedAtMs) / 1000) * TEST_SPEED;
      const estimatedRemaining = Math.max(0, lastSyncAnchorRef.current.remainingAtSync - elapsedSinceSync);

      remainingRef.current = estimatedRemaining;
      setRemainingSeconds(estimatedRemaining);

      if (estimatedRemaining <= 0) {
        handleCompleteFocus();
        return;
      }

      if (currentSess.session_id && !String(currentSess.session_id).startsWith('local_')) {
        syncWithServer();
      }
    });

    return () => subscription.remove();
  }, [plotIndex]);

  useEffect(() => {
    isMountedRef.current = true;
    isCompletingRef.current = false;
    hasCheckedOverworkRef.current = false;

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const calculateStageFromProgress = (progressValue) => {
    if (progressValue >= 100) return 5;
    if (progressValue >= 80) return 4;
    if (progressValue >= 50) return 3;
    if (progressValue >= 20) return 2;
    return 1;
  };

  const computeServerRemainingSeconds = (currentSession, tSec) => {
    if (!currentSession) return tSec;

    if (currentSession.remaining_seconds !== undefined && currentSession.remaining_seconds !== null) {
      return Math.max(0, Math.round(Number(currentSession.remaining_seconds)));
    }

    const endField = currentSession.ends_at || currentSession.expires_at || currentSession.end_at;
    if (endField) {
      const endMs = new Date(endField).getTime();
      if (!Number.isNaN(endMs)) {
        return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      }
    }

    if (currentSession.started_at && tSec) {
      const startMs = new Date(currentSession.started_at).getTime();
      if (!Number.isNaN(startMs)) {
        const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
        return Math.max(0, tSec - elapsedSec);
      }
    }

    return tSec;
  };

  const applyServerSessionState = (currentSession, farmData, { allowFallbackCropName = true, overrideRemaining = null } = {}) => {
    const sessionPlot = currentSession.plot_id
      ? farmData.find(p => p.plot_id === currentSession.plot_id)
      : null;
    const activePlotIndex = sessionPlot ? sessionPlot.plot_index - 1 : routePlotIndex;
    const activeCropName = allowFallbackCropName
      ? (cropName || sessionPlot?.crop_name || currentCropName)
      : (sessionPlot?.crop_name || cropName || currentCropName);

    const tSec = Number(currentSession.target_seconds || routeTargetSeconds || 600);
    const computedRem = computeServerRemainingSeconds(currentSession, tSec);

    // S07에서 넘어온 남은 시간이 있고 서버 값이 초기 전체 시간과 같을 때(서버가 일시정지/재개 시간을 못 줄인 경우) 보호
    let resolvedRemaining =
      overrideRemaining !== null && overrideRemaining !== undefined
        ? (computedRem >= tSec - 1 && overrideRemaining < tSec ? overrideRemaining : Math.min(computedRem, overrideRemaining))
        : computedRem;

    // 배속 테스트: 서버는 실제 시간이라 남은 시간이 더 많음 → 돌아왔을 때 시간이 뒤로 가지 않게 작은 쪽을 씀
    if (
      TEST_SPEED > 1 &&
      sessionRef.current?.session_id === currentSession.session_id &&
      remainingRef.current > 0
    ) {
      resolvedRemaining = Math.min(resolvedRemaining, remainingRef.current);
    }

    lastSyncAnchorRef.current = {
      syncedAtMs: Date.now(),
      remainingAtSync: resolvedRemaining,
    };

    sessionRef.current = currentSession;
    targetSecondsRef.current = tSec;
    remainingRef.current = resolvedRemaining;

    setSession(currentSession);
    setPlotIndex(activePlotIndex);
    setCurrentCropName(activeCropName);
    setTargetSeconds(tSec);
    setRemainingSeconds(resolvedRemaining);

    const currentProgress = calculateProgressForData(resolvedRemaining, tSec);
    const calculatedStage = calculateStageFromProgress(currentProgress);

    const formattedPlots = Array.from({ length: 12 }, (_, index) => {
      const isCurrentFocusPlot = index === activePlotIndex;
      const serverPlot = farmData.find(item => item.plot_index === index + 1);

      return {
        id: index,
        plotIndex: index,
        plotId: serverPlot?.plot_id || null,
        farmStatus: isCurrentFocusPlot ? 'growing' : (serverPlot?.farm_status || 'empty'),
        sessionStatus: isCurrentFocusPlot ? 'focusing' : (serverPlot?.session_status || null),
        cropId: isCurrentFocusPlot ? (currentSession.crop_id || cropId) : (serverPlot?.crop_id || null),
        cropName: isCurrentFocusPlot ? activeCropName : (serverPlot?.crop_name || null),
        stage: isCurrentFocusPlot ? calculatedStage : (serverPlot?.farm_status === 'ripe' ? 5 : 1),
      };
    });
    setPlotsData(formattedPlots);

    return resolvedRemaining;
  };

  const syncWithServer = async () => {
    if (!isFocusedRef.current || TEST_SPEED > 1) return;

    try {
      const [farmRes, activeRes] = await Promise.all([
        supabase.rpc('get_my_farm'),
        supabase.rpc('get_active_focus'),
      ]);
      if (farmRes.error) console.log('농장 조회 실패:', farmRes.error.message);
      if (activeRes.error) {
        console.log('활성 세션 조회 실패:', activeRes.error.message);
        return;
      }

      const farmData = farmRes.data || [];
      const activeSession = activeRes.data?.session ?? null;

      if (!activeSession || !isMountedRef.current || !isFocusedRef.current) return;

      const serverRemaining = applyServerSessionState(activeSession, farmData, {
        allowFallbackCropName: false,
      });

      if (serverRemaining <= 0) {
        handleCompleteFocus();
      }
    } catch (error) {
      console.log('서버 세션 동기화 실패:', error?.message);
    }
  };

  const initFocusSession = async () => {
    const isFirstLoad = firstLoadRef.current;
    try {
      if (isMountedRef.current && isFirstLoad) setLoading(true);

      const farmRes = await supabase.rpc('get_my_farm');
      if (farmRes.error) console.log('농장 조회 실패:', farmRes.error.message);
      const farmData = farmRes.data || [];

      let currentSession = null;
      const shouldStartNew = Boolean(isFirstLoad && !fromPause && (isNewPlanting || cropId));

      if (shouldStartNew) {
        const targetPlot = farmData.find(p => p.plot_index === routePlotIndex + 1);
        if (targetPlot?.plot_id && cropId) {
          const { data: startData, error: startError } = await supabase.rpc('start_focus', {
            p_plot_id: targetPlot.plot_id,
            p_crop_id: cropId,
          });
          if (startError) console.log('start_focus 실패:', startError.message);
          else currentSession = startData?.session ?? startData ?? null;
        }
      }

      if (!currentSession) {
        const activeRes = await supabase.rpc('get_active_focus');
        if (activeRes.error) console.log('활성 세션 조회 실패:', activeRes.error.message);
        else currentSession = activeRes.data?.session ?? null;
      }

      if (!currentSession) {
        const defaultTarget = routeTargetSeconds || 600;
        const defaultRem =
          routeRemainingSeconds !== undefined && routeRemainingSeconds !== null
            ? Math.max(0, Math.round(Number(routeRemainingSeconds)))
            : defaultTarget;

        currentSession = {
          session_id: sessionRef.current?.session_id || `local_session_${Date.now()}`,
          target_seconds: defaultTarget,
          remaining_seconds: defaultRem,
        };
      }

      if (!isMountedRef.current) return;

      const pauseOverride =
        fromPause && routeRemainingSeconds !== undefined && routeRemainingSeconds !== null
          ? Math.max(0, Math.round(Number(routeRemainingSeconds)))
          : null;

      const resolvedRemaining = applyServerSessionState(currentSession, farmData, {
        allowFallbackCropName: shouldStartNew,
        overrideRemaining: pauseOverride,
      });

      if (resolvedRemaining <= 0 && !shouldStartNew) {
        handleCompleteFocus();
      }
    } catch (error) {
      console.error('집중 세션 초기화 실패:', error.message);
    } finally {
      firstLoadRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  };

  const checkOverworkNotice = async (targetSessionId) => {
    if (!targetSessionId || hasCheckedOverworkRef.current || String(targetSessionId).startsWith('local_')) return;
    hasCheckedOverworkRef.current = true;

    try {
      const { data, error } = await supabase.rpc('claim_overwork_notice', {
        p_session_id: targetSessionId,
      });

      if (error) return;

      if (data?.show_overwork_notice === true && isMountedRef.current) {
        navigation.navigate('S12', {
          sessionId: targetSessionId,
          plotIndex,
          cropName: currentCropName,
        });
      }
    } catch (err) {
      // 무시
    }
  };

  const handleCompleteFocus = async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    remainingRef.current = 0;
    setRemainingSeconds(0);

    const currentSess = sessionRef.current;
    const serverSessionId =
      currentSess?.session_id && !String(currentSess.session_id).startsWith('local_')
        ? currentSess.session_id
        : undefined;

    let harvestSessionId = serverSessionId;

    if (serverSessionId) {
      try {
        const { error } = await supabase.rpc('finalize_my_focus');
        if (error) console.log('finalize_my_focus 안내:', error.message);
      } catch (err) {
        console.log('finalize_my_focus 예외 무시:', err?.message);
      }

      // 배속 테스트: 서버에선 아직 키우는 중이라 수확이 안 되고 밭도 계속 차 있음
      // → 씨앗으로 보관(중도 종료)해서 밭을 비움. 기록에는 씨앗 1개로 남음
      if (TEST_SPEED > 1) {
        try {
          const { data: active } = await supabase.rpc('get_active_focus');
          if (active?.session?.session_id === serverSessionId) {
            harvestSessionId = undefined;
            const { data: preview, error: previewError } = await supabase.rpc('preview_stop_focus', {
              p_session_id: serverSessionId,
            });
            if (previewError) throw previewError;
            const { error: confirmError } = await supabase.rpc('confirm_stop_focus', {
              p_stop_token: preview.stop_token,
            });
            if (confirmError) throw confirmError;
            console.log('배속 테스트: 서버에선 아직 덜 자라서 씨앗으로 보관하고 밭을 비웠어요');
          }
        } catch (err) {
          console.log('배속 테스트 정리 실패:', err?.message);
        }
      }
    }

    if (isMountedRef.current) {
      navigation.replace('S10', {
        cropName: currentCropName,
        minutes: Math.round(targetSecondsRef.current / 60) || 10,
        plotIndex,
        sessionId: harvestSessionId,
        isRipe: true,
      });
    }
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!session || !isFocused || isCompletingRef.current) return;

    // 화면 포커스 진입 시점 기준으로 anchor 갱신
    lastSyncAnchorRef.current = {
      syncedAtMs: Date.now(),
      remainingAtSync: remainingRef.current,
    };
    tickCountRef.current = 0;

    timerRef.current = setInterval(() => {
      if (!isMountedRef.current || !isFocusedRef.current || isCompletingRef.current) return;

      const elapsedSinceSync =
        Math.floor((Date.now() - lastSyncAnchorRef.current.syncedAtMs) / 1000) * TEST_SPEED;
      const nextSec = Math.max(0, lastSyncAnchorRef.current.remainingAtSync - elapsedSinceSync);

      if (nextSec <= 0) {
        remainingRef.current = 0;
        setRemainingSeconds(0);
        handleCompleteFocus();
        return;
      }

      if (nextSec !== remainingRef.current) {
        remainingRef.current = nextSec;
        setRemainingSeconds(nextSec);
      }

      const tSec = targetSecondsRef.current;
      const elapsedSec = tSec - nextSec;

      if (elapsedSec > 5400 && session?.session_id && !hasCheckedOverworkRef.current) {
        checkOverworkNotice(session.session_id);
      }

      const updatedProgress = Math.min(Math.max(Math.floor((elapsedSec / tSec) * 100), 0), 100);
      const newStage = calculateStageFromProgress(updatedProgress);

      setPlotsData(prevPlots =>
        prevPlots.some(p => p.id === plotIndex && p.stage !== newStage)
          ? prevPlots.map(p => (p.id === plotIndex ? { ...p, stage: newStage } : p))
          : prevPlots
      );

      tickCountRef.current += 1;
      if (tickCountRef.current % 10 === 0 && session?.session_id && !String(session.session_id).startsWith('local_')) {
        syncWithServer();
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session, plotIndex, isFocused]);

  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handlePauseFocus = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    let pausedRemaining = remainingRef.current;
    try {
      if (session?.session_id && !String(session.session_id).startsWith('local_')) {
        const { data } = await supabase.rpc('pause_focus', {
          p_session_id: session.session_id,
        });
        // 배속 테스트일 땐 서버(실제 시간)보다 앱 시간이 앞서 있으니 앱 시간을 그대로 씀
        if (TEST_SPEED === 1 && data?.remaining_seconds !== undefined && data?.remaining_seconds !== null) {
          pausedRemaining = Number(data.remaining_seconds);
        }
      }
    } catch (error) {
      console.log('일시정지 API 호출 실패(로컬 처리):', error.message);
    }

    if (isMountedRef.current) {
      navigation.replace('S07', {
        sessionId: session?.session_id || 'local_session',
        remainingSeconds: pausedRemaining,
        targetSeconds: targetSecondsRef.current,
        plotIndex,
        cropId: session?.crop_id || cropId,
        cropName: currentCropName,
      });
    }
  };

  const handleStopPreview = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const currentRem = remainingRef.current;
    const currentTarget = targetSecondsRef.current;

    let previewData = {
      focusSeconds: Math.max(0, currentTarget - currentRem),
      focusMinutes: Math.floor(Math.max(0, currentTarget - currentRem) / 60),
      progress: calculateProgressForData(currentRem, currentTarget),
      result: 'SEED',
    };

    try {
      if (session?.session_id && !String(session.session_id).startsWith('local_')) {
        const { data } = await supabase.rpc('preview_stop_focus', {
          p_session_id: session.session_id,
        });
        if (data) previewData = data;
      }
    } catch (error) {
      console.log('중도 종료 미리보기 API 실패(로컬 처리):', error.message);
    }

    if (isMountedRef.current) {
      navigation.navigate('S09', {
        previewData,
        sessionId: session?.session_id || 'local_session',
        plotIndex,
        remainingSeconds: currentRem,
        targetSeconds: currentTarget,
      });
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
  const currentStageIndex = calculateStageFromProgress(progress) - 1;

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
          cameraPos={[0, 7, 7.8]}
          modelOffsetY={1.7}
          plotsData={plotsData}
          selectedPlotIndex={plotIndex !== undefined ? plotIndex : null}
        />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View style={styles.topSpacer} />

        <View style={styles.bottomSheet}>
          <Text style={styles.title}>
            {currentCropName} 키우는 중{TEST_SPEED > 1 ? ` (${TEST_SPEED}배속 테스트)` : ''}
          </Text>
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
    paddingHorizontal: 24,
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
  },
  dotWrapper: {
    flex: 1,
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