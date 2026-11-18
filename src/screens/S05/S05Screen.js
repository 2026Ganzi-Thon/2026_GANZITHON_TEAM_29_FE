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

const BASE_MOCK_CROPS_DATA = [
  {
    crop_id: "10000000-0000-4000-8000-000000000001",
    name: "새싹채소",
    target_seconds: 600,
    sort_order: 1
  },
  {
    crop_id: "10000000-0000-4000-8000-000000000002",
    name: "당근",
    target_seconds: 1200,
    sort_order: 2
  },
  {
    crop_id: "10000000-0000-4000-8000-000000000003",
    name: "딸기",
    target_seconds: 1800,
    sort_order: 3
  },
  {
    crop_id: "10000000-0000-4000-8000-000000000004",
    name: "옥수수",
    target_seconds: 2700,
    sort_order: 4
  },
  {
    crop_id: "10000000-0000-4000-8000-000000000005",
    name: "토마토",
    target_seconds: 3600,
    sort_order: 5
  },
  {
    crop_id: "10000000-0000-4000-8000-000000000006",
    name: "호박",
    target_seconds: 5400,
    sort_order: 6
  }
];

export default function S05Screen({ route, navigation }) {
  const { plotIndex, energy } = route.params || {};
  
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [plotsData, setPlotsData] = useState([]);

  useEffect(() => {
    fetchCrops();
  }, [energy]);

  useEffect(() => {
    if (plotIndex !== undefined && selectedCrop) {
      setPlotsData([
        {
          plotIndex: plotIndex,
          cropName: selectedCrop.name,
          stage: 1,
          farmStatus: 'growing'
        }
      ]);
    }
  }, [plotIndex, selectedCrop]);

  const fetchCrops = async () => {
    try {
      setLoading(true);

      let recommendedNames = [];
      if (energy === 'low' || energy === '바닥이에요') {
        recommendedNames = ['새싹채소', '당근'];
      } else if (energy === 'medium' || energy === '그럭저럭') {
        recommendedNames = ['딸기', '옥수수'];
      } else if (energy === 'high' || energy === '충분해요') {
        recommendedNames = ['토마토', '호박'];
      }

      const cropList = BASE_MOCK_CROPS_DATA.map(crop => ({
        ...crop,
        recommended: recommendedNames.includes(crop.name)
      }));

      setCrops(cropList);
      // 💡 첫 진입 시 자동 선택을 제거하여 아무것도 미리 선택되지 않도록 수정
    } catch (error) {
      console.error('작물 목록 조회 실패:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitleByEnergy = () => {
    switch (energy) {
      case 'low':
      case '바닥이에요':
        return '오늘은 새싹채소 하나면\n충분해요';
      case 'medium':
      case '그럭저럭':
        return '적당히 키워볼까요?';
      case 'high':
      case '충분해요':
        return '오늘은 크게 키워볼까요?';
      default:
        return '무엇을 키워볼까요?';
    }
  };

  const handleStartFocus = () => {
    if (!selectedCrop) return;
    navigation.navigate('S06', {
      plotIndex,
      cropId: selectedCrop.crop_id || selectedCrop.id,
      cropName: selectedCrop.name, // 💡 S06으로 작물 이름 전달
    });
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
          cameraPos={[0, 8, 8]}
          cameraLookAt={[0, 0.5, 0]}
          modelOffsetY={2.5}
          plotsData={plotsData}
          selectedPlotIndex={plotIndex !== undefined ? plotIndex : null}
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
          {getTitleByEnergy()}
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
              const isSelected = selectedCrop?.name === item.name;
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
                  {item.recommended && (
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
    borderWidth: 2.5,
    backgroundColor: COLORS.white,
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