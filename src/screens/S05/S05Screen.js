import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { supabase } from '../../utils/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function S05Screen({ route, navigation }) {
  const { plotIndex, energy } = route.params || {};
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCropId, setSelectedCropId] = useState(null);

  useEffect(() => {
    fetchCrops();
  }, [energy]);

  const fetchCrops = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('list_crops', {
        p_energy: energy,
      });

      if (error) {
        throw error;
      }

      setCrops(data || []);
    } catch (error) {
      console.error('작물 목록 조회 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFocus = () => {
    if (!selectedCropId) return;
    navigation.navigate('S06', { plotIndex, cropId: selectedCropId });
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('S04');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.black || '#000'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backIcon}>〈</Text>
        </Pressable>
        <Text style={styles.stepText}>2 / 2</Text>
      </View>

      <Text style={styles.title}>심을 작물을 골라주세요</Text>
      <Text style={styles.subtitle}>컨디션에 맞는 추천 작물에 표시가 되어 있어요</Text>

      <FlatList
        data={crops}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const isSelected = selectedCropId === item.id;
          return (
            <Pressable
              style={[
                styles.cropCard,
                isSelected && styles.selectedCard,
              ]}
              onPress={() => setSelectedCropId(item.id)}
            >
              <View>
                <Text style={styles.cropTitle}>{item.name}</Text>
                <Text style={styles.cropDesc}>목표 집중 시간: {item.target_time}분</Text>
              </View>
              {item.is_recommended && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>추천</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.nextButton, !selectedCropId && styles.disabledButton]}
        onPress={handleStartFocus}
      >
        <Text style={styles.nextButtonText}>집중 시작하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white || '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 36,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  backIcon: {
    fontSize: 20,
    color: COLORS.black,
    fontWeight: 'bold',
  },
  stepText: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    fontWeight: FONTS.weight.medium,
  },
  title: {
    fontSize: FONTS.size.title || 22,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FONTS.size.body,
    color: COLORS.graytext,
    marginBottom: 24,
  },
  listContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  cropCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
  },
  selectedCard: {
    borderColor: COLORS.black,
    borderWidth: 2,
    backgroundColor: COLORS.Graycontainer || '#F2F2F2',
  },
  cropTitle: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 4,
  },
  cropDesc: {
    fontSize: FONTS.size.body - 2,
    color: COLORS.graytext,
  },
  badge: {
    backgroundColor: '#E2F0D9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: FONTS.size.body - 2,
    color: '#385723',
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: COLORS.black || '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.white,
  },
});