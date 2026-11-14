import { StyleSheet } from 'react-native';
import { COLORS } from './colors';

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  modal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },

  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  text: {
    color: COLORS.text,
    fontSize: 15,
  },

  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
});