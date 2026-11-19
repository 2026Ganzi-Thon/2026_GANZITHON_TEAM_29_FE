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

export default function S09Screen({ route, navigation }) {
  const { sessionId, previewData, plotIndex } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [plotsData, setPlotsData] = useState([]);
  const [stopInfo, setStopInfo] = useState({
    focusMinutes: previewData?.focusMinutes ?? previewData?.focus_minutes ?? 0,
    focusSeconds: previewData?.focusSeconds ?? previewData?.focus_seconds ?? 0,
    progress: previewData?.progress ?? 0,
    result: previewData?.result ?? 'SEED',
    // preview_stop_focus가 주는 확정용 토큰 (confirm/cancel_stop_focus에 씀)
    stopToken: previewData?.stop_token ?? null,
  });
  const isServerSession = !!sessionId && !String(sessionId).startsWith('local_');

  useEffect(() => {
    fetchFarmAndPreviewData();
  }, []);

  const fetchFarmAndPreviewData = async () => {
    try {
      const { data: farmData } = await supabase.rpc('get_my_farm');
      if (farmData) {
        const formattedPlots = Array.from({ length: 12 }, (_, index) => {
          const serverPlot = farmData.find(item => item.plot_index === index + 1);
          return {
            id: index,
            plotIndex: index,
            plotId: serverPlot?.plot_id || null,
            farmStatus: serverPlot?.farm_status || 'empty',
            cropName: serverPlot?.crop_name || '작물',
          };
        });
        setPlotsData(formattedPlots);
      }

    
      if (!previewData?.stop_token && isServerSession) {
        setLoading(true);
        const { data, error } = await supabase.rpc('preview_stop_focus', {
          p_session_id: sessionId,
        });

        if (!error && data) {
          setStopInfo({
            focusMinutes: data.focus_minutes ?? 0,
            focusSeconds: data.focused_seconds ?? 0,
            progress: data.progress_percent ?? 0,
            result: data.result ?? 'seed',
            stopToken: data.stop_token ?? null,
          });
        }
      }
    } catch (error) {
      console.error('S09 데이터 로드 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStop = async () => {
    try {
      setLoading(true);

      if (isServerSession && stopInfo.stopToken) {
        const { error } = await supabase.rpc('confirm_stop_focus', {
          p_stop_token: stopInfo.stopToken,
        });
        if (error) console.log('씨앗 보관 실패:', error.message);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'S03' }],
      });
    } catch (error) {
      console.error('씨앗 보관 처리 실패:', error.message);
      navigation.reset({
        index: 0,
        routes: [{ name: 'S03' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinueGrowing = async () => {
    // 미리보기 토큰을 취소해야 서버에서 계속 키울 수 있음
    if (isServerSession && stopInfo.stopToken) {
      const { error } = await supabase.rpc('cancel_stop_focus', { p_stop_token: stopInfo.stopToken });
      if (error) console.log('중도 종료 취소 실패:', error.message);
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('S06', { sessionId, plotIndex });
    }
  };

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D
          cameraPos={[0, 5.0, 5.8]}
          modelOffsetY={0.4}
          plotsData={plotsData}
          selectedPlotIndex={plotIndex ?? null}
        />
      </View>

      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View style={styles.topSpacer} />

        <View style={styles.bottomSheet}>
          <Text style={styles.title}>오늘은 여기까지 할까요?</Text>

          <View style={styles.seedPouchBox}>
            <Text style={styles.seedPouchText}>씨앗 주머니</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={COLORS.black} style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descMain}>
                지금까지 {stopInfo.focusMinutes}분 키웠어요.
              </Text>
              <Text style={styles.descSub}>씨앗을 주머니에 보관할게요.</Text>
              <Text style={styles.descEncourage}>시작한 것만으로도 충분해요</Text>
            </View>
          )}

          <Pressable
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleConfirmStop}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>씨앗 보관하기</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleContinueGrowing}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>계속 키우기</Text>
          </Pressable>
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
    paddingTop: 28,
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
    marginBottom: 20,
  },
  seedPouchBox: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  seedPouchText: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext || '#767676',
    fontWeight: FONTS.weight.medium,
  },
  descriptionContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  descMain: {
    fontSize: FONTS.size.body,
    color: COLORS.black,
    fontWeight: FONTS.weight.medium,
    lineHeight: 22,
  },
  descSub: {
    fontSize: FONTS.size.body,
    color: COLORS.black,
    fontWeight: FONTS.weight.medium,
    lineHeight: 22,
    marginBottom: 8,
  },
  descEncourage: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext || '#8E8E93',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.black || '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.white || '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: COLORS.white || '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.black || '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black || '#1A1A1A',
  },
});