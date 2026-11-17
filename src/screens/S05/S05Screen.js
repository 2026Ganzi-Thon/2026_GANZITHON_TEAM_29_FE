import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import { commonStyles } from '../../styles/commonStyles';
import { supabase } from '../../utils/supabase';

import FarmScene3D from '../../components/farm/FarmScene3D';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function S05Screen({ route, navigation }) {
  const { plotIndex, energy } = route.params || {};
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState(null);

  useEffect(() => {
    fetchCrops();
  }, [energy]);

  const fetchCrops = async () => {
    try {
      setLoading(true);

      const queryParam = energy ? { p_energy: energy } : {}; 
      
      const { data, error } = await supabase.rpc('list_crops', queryParam);

      if (error) {
        throw error;
      }

      setCrops(data || []);
      if (data && data.length > 0) {
        const recommended = data.find(c => c.recommended || c.is_recommended) || data[0];
        setSelectedCrop(recommended);
      }
    } catch (error) {
      console.error('작물 목록 조회 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFocus = () => {
    if (!selectedCrop) return;
    navigation.navigate('S06', { plotIndex, cropId: selectedCrop.crop_id || selectedCrop.id });
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('S04');
    }
  };

  return (
    <View style={commonStyles.screen}>
      <View style={styles.farmBackground}>
        <FarmScene3D 
          cameraPos={[0, 5.0, 5.8]} 
          modelOffsetY={0.4} 
          selectedPlotIndex={plotIndex}
        />
      </View>

      <Pressable 
        style={styles.backdrop} 
        onPress={handleGoBack} 
      />

      <View style={styles.bottomSheet}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backIcon}>〈</Text>
          </Pressable>
          <Text style={styles.stepText}>2 / 2</Text>
        </View>

        <Text style={styles.title}>
          {energy === 'low' ? '오늘은 새싹채소 하나면\n충분해요' : '심을 작물을 골라주세요'}
        </Text>
        <Text style={styles.subtitle}>작물마다 키우는 시간이 달라요</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.black} />
          </View>
        ) : (
          <FlatList
            data={crops}
            numColumns={3}
            keyExtractor={(item, index) => item.crop_id?.toString() || item.id?.toString() || index.toString()}
            contentContainerStyle={styles.gridContainer}
            columnWrapperStyle={styles.columnWrapper}
            renderItem={({ item }) => {
              const isSelected = selectedCrop?.crop_id === item.crop_id || selectedCrop?.id === item.id;
              const minutes = Math.floor((item.target_seconds || 600) / 60);

              return (
                <Pressable
                  style={[
                    styles.cropCard,
                    isSelected && styles.selectedCard,
                  ]}
                  onPress={() => setSelectedCrop(item)}
                >
                  <View style={styles.cropIconPlaceholder} />
                  <Text style={styles.cropName}>{item.name}</Text>
                  <Text style={styles.cropTime}>{minutes}분</Text>
                  {(item.recommended || item.is_recommended) && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>추천</Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}

        <Pressable
          style={[styles.startButton, !selectedCrop && styles.disabledButton]}
          onPress={handleStartFocus}
        >
          <Text style={styles.startButtonText}>
            {selectedCrop ? `${selectedCrop.name} 심기 · ${Math.floor((selectedCrop.target_seconds || 600) / 60)}분` : '작물을 선택해주세요'}
          </Text>
        </Pressable>
      </View>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: SCREEN_HEIGHT * 0.65,
    zIndex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white || '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: SCREEN_HEIGHT * 0.72,
    zIndex: 2,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: FONTS.size.title || 20,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    lineHeight: 28,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.size.body - 1,
    color: COLORS.graytext,
    marginBottom: 16,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    paddingBottom: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cropCard: {
    width: '31%',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  selectedCard: {
    borderColor: COLORS.black,
    borderWidth: 2,
    backgroundColor: '#F9F9F9',
  },
  cropIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAEAEA',
    marginBottom: 8,
  },
  cropName: {
    fontSize: FONTS.size.body - 1,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 2,
  },
  cropTime: {
    fontSize: FONTS.size.body - 2,
    color: COLORS.graytext,
  },
  badge: {
    marginTop: 6,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    color: COLORS.black,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: COLORS.black || '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.white,
  },
});