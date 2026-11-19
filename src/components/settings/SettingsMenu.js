import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../common/AppButton';
import { COLORS } from '../../styles/colors';
import { getSession, signOut } from '../../lib/auth';
import { fetchHistory, totalMinutes } from '../../lib/records';
import { formatMinutes } from '../../utils/time';

const RED = '#E5484D';

const MENU = [
  { key: 'profile', label: '내 정보', icon: 'person-outline' },
  { key: 'settings', label: '설정', icon: 'settings-outline' },
  { key: 'help', label: '도움말', icon: 'help-circle-outline' },
  { key: 'logout', label: '로그아웃', icon: 'log-out-outline', danger: true },
];

// TODO: 각 항목 화면이 정해지면 연결
const SETTINGS_ITEMS = ['테마 설정', '프로필 설정', '언어 선택', '개인정보 처리방침'];
const HELP_ITEMS = ['개발자에게 문의하기', '작물', '로그인'];

export default function SettingsMenu({ visible, onClose }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <SafeAreaView edges={['top']} style={styles.menuArea} pointerEvents="box-none">
        <View style={styles.menu}>
          {MENU.map((item) => (
            <MenuItem
              key={item.key}
              item={item}
              selected={selected === item.key}
              dimmed={selected !== null && selected !== item.key}
              onPress={() => setSelected(item.key)}
            />
          ))}
        </View>
      </SafeAreaView>

      {selected && (
        <SafeAreaView
          edges={['bottom']}
          style={[styles.sheet, selected !== 'logout' && styles.sheetTall]}
        >
          {selected === 'profile' && <ProfileSection />}
          {selected === 'settings' && <ListSection title="설정" items={SETTINGS_ITEMS} />}
          {selected === 'help' && <ListSection title="도움말" items={HELP_ITEMS} />}
          {selected === 'logout' && <LogoutSection onCancel={() => setSelected(null)} />}
        </SafeAreaView>
      )}
    </Modal>
  );
}

function MenuItem({ item, selected, dimmed, onPress }) {
  const color = item.danger ? RED : COLORS.black;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuItem, selected && styles.menuItemSelected, dimmed && styles.menuItemDimmed]}
    >
      <Ionicons name={item.icon} size={18} color={color} />
      <Text style={[styles.menuText, { color }]}>{item.label}</Text>
    </Pressable>
  );
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day}`;
}

function ProfileSection() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([getSession(), fetchHistory('all')])
      .then(([session, history]) => {
        if (!alive) return;
        setInfo({ joinedAt: session?.user?.created_at, minutes: totalMinutes(history) });
      })
      .catch((e) => {
        console.error('내 정보 불러오기 실패:', e);
        if (alive) setError(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  let content;
  if (error) {
    content = <Text style={styles.sheetMuted}>정보를 불러오지 못했어요</Text>;
  } else if (!info) {
    content = <Text style={styles.sheetMuted}>불러오는 중...</Text>;
  } else {
    content = (
      <>
        <Text style={styles.sheetText}>가입일 : {formatDate(info.joinedAt)}</Text>
        <Text style={styles.sheetText}>총 사용시간 : {formatMinutes(info.minutes)}</Text>
      </>
    );
  }

  return (
    <>
      <Text style={styles.sheetTitle}>내 정보</Text>
      {content}
    </>
  );
}

function ListSection({ title, items }) {
  return (
    <>
      <Text style={styles.sheetTitle}>{title}</Text>
      {items.map((label) => (
        <Text key={label} style={styles.sheetText}>
          {label}
        </Text>
      ))}
    </>
  );
}

function LogoutSection({ onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 로그아웃되면 AppNavigator가 S18로 보내고, 이 창도 자동으로 닫힘
  const logout = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      await signOut();
    } catch (e) {
      console.error('로그아웃 실패:', e);
      setError('로그아웃하지 못했어요. 다시 시도해 주세요');
      setLoading(false);
    }
  };

  return (
    <>
      <Text style={styles.sheetTitle}>정말 로그아웃 하시겠습니까?</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <AppButton
        title="예"
        variant="outline"
        onPress={logout}
        disabled={loading}
        style={styles.yesButton}
        textStyle={styles.yesText}
      />
      <AppButton title="아니요" variant="outline" onPress={onCancel} disabled={loading} />
    </>
  );
}

const styles = StyleSheet.create({
  menuArea: {
    alignItems: 'center',
  },

  menu: {
    width: 160,
    marginTop: 40,
    padding: 8,
    gap: 6,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.Gray,
  },

  menuItemSelected: {
    borderColor: COLORS.darkGray,
  },

  menuItemDimmed: {
    opacity: 0.35,
  },

  menuText: {
    fontSize: 14,
    fontWeight: '700',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.white,
  },

  sheetTall: {
    minHeight: '34%',
  },

  sheetTitle: {
    marginBottom: 6,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
  },

  sheetText: {
    marginTop: 10,
    fontSize: 15,
    color: COLORS.black,
  },

  sheetMuted: {
    marginTop: 10,
    fontSize: 15,
    color: '#A6A6A6',
  },

  error: {
    marginTop: 8,
    fontSize: 13,
    color: RED,
  },

  yesButton: {
    marginTop: 16,
    marginBottom: 10,
    borderColor: RED,
  },

  yesText: {
    color: RED,
  },
});
