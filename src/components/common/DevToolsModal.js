// src/components/common/DevToolsModal.js

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../styles/colors';
import { FONTS } from '../../styles/fonts';

export default function DevToolsModal({ navigation }) {
  const [visible, setVisible] = useState(false);

  // 💡 수정된 부분: clear() 대신 지정한 키들만 삭제하거나 초기화
  const handleResetToLogin = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 
        'settings_onboarded', 
        'userFarmRecords'
      ]);
    } catch (e) {
      // 에러가 나더라도 무시하고 네비게이션 이동 수행
    }
    
    setVisible(false);
    // S18 화면으로 이동 (로그아웃 상태)
    navigation.reset({ index: 0, routes: [{ name: 'S18' }] });
  };

  const handleGoToS02 = async () => {
    await AsyncStorage.setItem('userToken', 'dummy_token');
    await AsyncStorage.setItem('settings_onboarded', 'true');
    setVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'S02' }] });
  };

  const handleGoToS03 = async () => {
    await AsyncStorage.setItem('userToken', 'dummy_token');
    await AsyncStorage.setItem('settings_onboarded', 'true');
    await AsyncStorage.setItem('userFarmRecords', JSON.stringify([{ id: 1 }]));
    setVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'S03' }] });
  };

  return (
    <>
      <Pressable style={styles.floatingButton} onPress={() => setVisible(true)}>
        <Text style={styles.floatingButtonText}>🛠 DEV</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>개발자 빠른 이동 툴</Text>

            <Pressable style={styles.devButton} onPress={handleResetToLogin}>
              <Text style={styles.devButtonText}>로그아웃 상태 (S18 이동)</Text>
            </Pressable>

            <Pressable style={styles.devButton} onPress={handleGoToS02}>
              <Text style={styles.devButtonText}>온보딩 완료 상태 (S02 이동)</Text>
            </Pressable>

            <Pressable style={styles.devButton} onPress={handleGoToS03}>
              <Text style={styles.devButtonText}>농장 기록 있음 상태 (S03 이동)</Text>
            </Pressable>

            <Pressable style={[styles.devButton, styles.closeButton]} onPress={() => setVisible(false)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// 스타일 코드는 기존과 동일하게 유지
const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    zIndex: 9999,
  },
  floatingButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: FONTS.size.title - 2,
    fontWeight: FONTS.weight.bold,
    marginBottom: 16,
    color: COLORS.black,
  },
  devButton: {
    width: '100%',
    backgroundColor: COLORS.Graycontainer,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: FONTS.size.body - 1,
    fontWeight: FONTS.weight.medium,
    color: COLORS.black,
  },
  closeButton: {
    backgroundColor: COLORS.black,
    marginTop: 6,
  },
  closeButtonText: {
    color: COLORS.white,
    fontWeight: FONTS.weight.bold,
  },
});