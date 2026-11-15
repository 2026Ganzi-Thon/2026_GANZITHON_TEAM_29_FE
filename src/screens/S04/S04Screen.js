import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';
import FarmScene3D from '../../components/farm/FarmScene3D';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function S04Screen({ route, navigation }) {
  const { plotIndex } = route.params || {};
  const [selectedEnergy, setSelectedEnergy] = useState(null);

  const handleNext = () => {
    if (!selectedEnergy) return;
    navigation.navigate('S05', { plotIndex, energy: selectedEnergy });
  };

  const handleSkip = () => {
    navigation.navigate('S05', { plotIndex, energy: null });
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('S03');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sceneContainer}>
        <FarmScene3D selectedPlotIndex={plotIndex} />
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
          <Text style={styles.stepText}>1 / 2</Text>
        </View>

        <Text style={styles.title}>오늘 에너지는 어때요?</Text>
        <Text style={styles.subtitle}>컨디션에 맞는 작물을 추천해 드려요</Text>

        <View style={styles.optionsContainer}>
          <Pressable
            style={[
              styles.optionCard,
              selectedEnergy === 'low' && styles.selectedCard,
            ]}
            onPress={() => setSelectedEnergy('low')}
          >
            <Text style={styles.cardTitle}>바닥이에요</Text>
            <Text style={styles.cardDesc}>아주 작게 시작해요</Text>
          </Pressable>

          <Pressable
            style={[
              styles.optionCard,
              selectedEnergy === 'medium' && styles.selectedCard,
            ]}
            onPress={() => setSelectedEnergy('medium')}
          >
            <Text style={styles.cardTitle}>그럭저럭</Text>
            <Text style={styles.cardDesc}>적당히 키워봐요</Text>
          </Pressable>

          <Pressable
            style={[
              styles.optionCard,
              selectedEnergy === 'high' && styles.selectedCard,
            ]}
            onPress={() => setSelectedEnergy('high')}
          >
            <Text style={styles.cardTitle}>충분해요</Text>
            <Text style={styles.cardDesc}>크게 키워봐요</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>

        <Pressable 
          style={[styles.nextButton, !selectedEnergy && styles.disabledButton]} 
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>다음</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  sceneContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: SCREEN_HEIGHT * 0.5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white || '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    maxHeight: SCREEN_HEIGHT * 0.85,
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
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
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
  cardTitle: {
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.bold,
    color: COLORS.black,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: FONTS.size.body - 2,
    color: COLORS.graytext,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  skipText: {
    fontSize: FONTS.size.body,
    color: COLORS.graytext,
    fontWeight: FONTS.weight.medium,
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