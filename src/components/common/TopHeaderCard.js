import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/colors';

export default function TopHeaderCard({ children, style }) {
  return (
    <View style={[styles.topCard, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.88)', 
    borderRadius: 12, 
    paddingHorizontal: 20, // 💡 좌우 패딩을 줄여서 박스 가로 면적이 더 넓어 보이게 조절
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
});