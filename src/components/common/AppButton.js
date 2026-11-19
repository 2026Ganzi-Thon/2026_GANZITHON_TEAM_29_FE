import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../../styles/colors';

/**
 * 공통 버튼
 *
 * variant
 *  - 'primary' : 검정 배경 + 흰 글씨 (기본)
 *  - 'outline' : 흰 배경 + 검정 테두리
 *  - 'text'    : 배경 없이 회색 글씨 (예: [농장으로], [기록 모두 지우기])
 *
 * 사용법:
 *   <AppButton title="수확하기" onPress={...} />
 *   <AppButton title="나중에" variant="outline" onPress={...} />
 *   <AppButton title="저장" disabled={loading} onPress={...} />  ← 요청 중 중복 누름 방지
 *   <AppButton title="예" variant="outline" textStyle={{ color: 'red' }} />  ← 글자 색 바꾸기
 */
export default function AppButton({ title, onPress, variant = 'primary', style, textStyle, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.textBase, styles[`${variant}Text`], textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  primary: {
    backgroundColor: COLORS.black,
  },

  outline: {
    borderWidth: 1.5,
    borderColor: COLORS.black,
    backgroundColor: COLORS.white,
  },

  text: {
    backgroundColor: 'transparent',
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.4,
  },

  textBase: {
    fontSize: 16,
    fontWeight: '700',
  },

  primaryText: {
    color: COLORS.white,
  },

  outlineText: {
    color: COLORS.black,
  },

  textText: {
    color: COLORS.graytext,
  },
});
