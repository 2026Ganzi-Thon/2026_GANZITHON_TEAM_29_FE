import React from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { COLORS } from '../../styles/colors';

export default function AppTextInput({ style, ...props }) {
  return (
    <TextInput
      placeholderTextColor="#A6A6A6"
      style={[styles.input, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.darkGray,
    borderRadius: 12,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
});
