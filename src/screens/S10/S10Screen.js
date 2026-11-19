import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import AppTextInput from '../../components/common/AppTextInput';
import { COLORS } from '../../styles/colors';
import { eulReul } from '../../utils/josa';
import { harvestCrop, harvestErrorMessage, saveHarvestNote, startRest } from '../../lib/harvest';

// S10 수확 완료
// - S17에서 오면 harvestId를 받음 (이미 수확함)
// - S06에서 바로 오면 sessionId를 받아서 여기서 수확함
export default function S10Screen({ navigation, route }) {
  const {
    cropName = '당근',
    minutes: paramMinutes = 20,
    sessionId,
    harvestId: paramHarvestId,
    plotIndex,
  } = route.params ?? {};

  const [harvestId, setHarvestId] = useState(paramHarvestId ?? null);
  const [minutes, setMinutes] = useState(paramMinutes);
  const [showRestCard, setShowRestCard] = useState(true);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (paramHarvestId || !sessionId) return;
    let alive = true;

    harvestCrop(sessionId)
      .then((result) => {
        if (!alive) return;
        setHarvestId(result.harvest_id);
        if (result.focused_seconds) setMinutes(Math.round(result.focused_seconds / 60));
      })
      .catch((e) => {
        // 10배속 테스트처럼 서버에서 아직 다 자라지 않은 경우 NOT_RIPE
        console.log('수확 저장 실패:', e.code);
      });

    return () => {
      alive = false;
    };
  }, [paramHarvestId, sessionId]);

  const goRest = async () => {
    if (loading) return;

    // TODO: 수확 기록이 없을 때(테스트 등)는 서버 없이 5분 휴식
    if (!harvestId) {
      navigation.navigate('S11', { plotIndex });
      return;
    }

    setLoading(true);
    setError('');
    try {
      const rest = await startRest(harvestId);
      navigation.navigate('S11', {
        restEndsAt: rest.rest_ends_at,
        serverNow: rest.server_now,
        plotIndex,
      });
    } catch (e) {
      setError(harvestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const goToFarm = async () => {
    if (loading) return;
    const note = memo.trim();

    if (!note || !harvestId) {
      navigation.popTo('S03', { justHarvested: true });
      return;
    }

    setLoading(true);
    setError('');
    try {
      // guidance_required(저장 안 됨)여도 S13 없이 농장으로 감
      await saveHarvestNote(harvestId, note);
      navigation.popTo('S03', { justHarvested: true });
    } catch (e) {
      setError(harvestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    // TODO: 수확 3D 연출 (작물이 밭에서 튀어 오르며 반짝임, 1.5초)
    <FarmSheetLayout>
      <Text style={styles.title}>{eulReul(cropName)} 수확했어요!</Text>
      <Text style={styles.subtitle}>{minutes}분 동안 함께 키웠어요</Text>

      {showRestCard && (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>5분 물 주며 쉬어갈까요?</Text>

          <View style={styles.restButtons}>
            <AppButton
              title="쉬어가기"
              onPress={goRest}
              disabled={loading}
              style={styles.restButton}
            />
            <AppButton
              title="건너뛰기"
              variant="outline"
              onPress={() => setShowRestCard(false)}
              disabled={loading}
              style={styles.restButton}
            />
          </View>
        </View>
      )}

      <AppTextInput
        style={styles.memoInput}
        placeholder="오늘 한 줄 남기기 (선택)"
        value={memo}
        onChangeText={setMemo}
        maxLength={50}
        returnKeyType="done"
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <AppButton title="농장으로 가기" onPress={goToFarm} disabled={loading} />
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.graytext,
    textAlign: 'center',
  },

  restCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.Gray,
  },

  restTitle: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },

  restButtons: {
    flexDirection: 'row',
    gap: 10,
  },

  restButton: {
    flex: 1,
    width: undefined,
  },

  memoInput: {
    marginTop: 16,
    marginBottom: 16,
  },

  error: {
    marginTop: -6,
    marginBottom: 12,
    fontSize: 13,
    color: '#E5484D',
    textAlign: 'center',
  },
});
