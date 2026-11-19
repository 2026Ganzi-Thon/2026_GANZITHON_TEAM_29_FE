import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '../common/AppButton';
import { COLORS } from '../../styles/colors';

// S16 기록 삭제 확인 창 (S14 위에 뜸)
export default function DeleteRecordsDialog({ visible, onConfirm, onCancel, loading = false, error = '' }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <Text style={styles.title}>기록을 모두 지울까요?</Text>
          <Text style={styles.message}>
            {'농장과 집중 기록이 서버에서 삭제되고\n되돌릴 수 없어요.'}
          </Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <AppButton
            title={loading ? '지우는 중...' : '모두 지우기'}
            onPress={onConfirm}
            disabled={loading}
            style={styles.confirmButton}
          />
          <AppButton title="취소" variant="outline" onPress={onCancel} disabled={loading} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: COLORS.overlay,
  },

  dialog: {
    paddingTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  message: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.graytext,
    textAlign: 'center',
  },

  error: {
    marginTop: 12,
    fontSize: 13,
    color: '#E5484D',
    textAlign: 'center',
  },

  confirmButton: {
    marginTop: 20,
    marginBottom: 14,
  },
});
