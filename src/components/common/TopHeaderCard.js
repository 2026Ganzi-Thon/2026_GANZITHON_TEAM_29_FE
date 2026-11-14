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
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 5,
  },
});