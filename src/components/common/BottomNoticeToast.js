import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';

export default function BottomNoticeToast({ message, style }) {
  return (
    <View style={[styles.toastContainer, style]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    backgroundColor: COLORS.black,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: COLORS.white,
    fontSize: FONTS.size.body - 1,
    fontWeight: FONTS.weight.medium,
  },
});