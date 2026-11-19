import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';

export default function BottomNoticeToast({ message, style, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.toastContainer,
        style,
        pressed && onPress && styles.pressed,
      ]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Pressable>
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
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  toastText: {
    color: COLORS.white,
    fontSize: FONTS.size.body,
    fontWeight: FONTS.weight.medium,
  },
});
