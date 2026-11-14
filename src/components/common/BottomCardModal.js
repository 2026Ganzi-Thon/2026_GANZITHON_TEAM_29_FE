import React from 'react';
import { View, StyleSheet } from 'react-native';
import { commonStyles } from '../../styles/commonStyles';

export default function BottomCardModal({ children, style }) {
  return (
    <View style={[commonStyles.modal, styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
});