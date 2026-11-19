import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import { COLORS } from '../../styles/colors';
import { iGa } from '../../utils/josa';
import { harvestCrop, harvestErrorMessage } from '../../lib/harvest';

// S17 수확 확인 창 (S03에서 다 자란 밭을 누르면 열림)
export default function S17Screen({ navigation, route }) {
  const { cropName = '당근', minutes = 20, sessionId, plotIndex } = route.params ?? {};

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('S03');
  };

  const harvest = async () => {
    if (loading) return;

    // TODO: S03에서 sessionId를 넘겨주면 이 분기 지우기
    if (!sessionId) {
      navigation.navigate('S10', { cropName, minutes, plotIndex });
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await harvestCrop(sessionId);
      navigation.navigate('S10', {
        cropName,
        minutes: Math.round(result.focused_seconds / 60) || minutes,
        harvestId: result.harvest_id,
        plotIndex,
      });
    } catch (e) {
      setError(harvestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    // TODO: 다 자란 밭 3D 렌더
    <FarmSheetLayout onPressOutside={close}>
      <Text style={styles.title}>{iGa(cropName)} 다 자랐어요</Text>

      {/* TODO: 작물 이미지 나오면 교체 */}
      <View style={styles.cropImage}>
        <Text style={styles.cropImageText}>다 자란 {cropName}</Text>
      </View>

      <Text style={styles.message}>
        {`${minutes}분 동안 함께 키웠어요.\n지금 수확할까요?`}
      </Text>
      <Text style={styles.notice}>오늘 자정이 지나면 자동으로 수확돼요</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <AppButton
        title="수확하기"
        onPress={harvest}
        disabled={loading}
        style={styles.harvestButton}
      />
      <AppButton title="나중에" variant="outline" onPress={close} disabled={loading} />
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  cropImage: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E6E6E6',
  },

  cropImageText: {
    fontSize: 12,
    color: COLORS.graytext,
  },

  message: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 22,
    color: '#424242',
    textAlign: 'center',
  },

  notice: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.graytext,
    textAlign: 'center',
  },

  error: {
    marginTop: 12,
    fontSize: 13,
    color: '#E5484D',
    textAlign: 'center',
  },

  harvestButton: {
    marginTop: 16,
    marginBottom: 16,
  },
});
