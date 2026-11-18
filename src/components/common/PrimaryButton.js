import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { commonStyles } from '../../styles/commonStyles';

export default function PrimaryButton({ title, onPress, style }) {
  return (
    <Pressable style={[commonStyles.button, styles.button, style]} onPress={onPress}>
      <Text style={commonStyles.buttonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 18,
  },
});