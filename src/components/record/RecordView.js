import React, { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import FarmSheetLayout from '../common/FarmSheetLayout';
import AppButton from '../common/AppButton';
import DeleteRecordsDialog from './DeleteRecordsDialog';
import { COLORS } from '../../styles/colors';
import { formatMinutes } from '../../utils/time';
import {
  fetchHistory,
  monthRows,
  resetFarmHistory,
  summarySentence,
  todayRows,
  totalMinutes,
  weekRows,
} from '../../lib/records';

// 다 자란 작물 3D 모델을 찍은 이미지
const CROP_ICONS = {
  새싹채소: require('../../../assets/images/crops/sprout.png'),
  당근: require('../../../assets/images/crops/carrot.png'),
  토마토: require('../../../assets/images/crops/tomato.png'),
  옥수수: require('../../../assets/images/crops/corn.png'),
  딸기: require('../../../assets/images/crops/strawberry.png'),
  호박: require('../../../assets/images/crops/pumpkin.png'),
  씨앗: require('../../../assets/images/crops/seed.png'),
};

// S14 오늘 / S15 이번 주 / S15-1 전체

const TABS = [
  { key: 'today', label: '오늘', summaryLabel: '오늘 키운 시간' },
  { key: 'week', label: '이번 주', summaryLabel: '이번 주 키운 시간' },
  { key: 'all', label: '전체', summaryLabel: '총 키운 시간' },
];

// 화면 높이 중 농장이 차지하는 비율
const FARM_HEIGHT_RATIO = 0.42;

const LIGHT_GRAY_TEXT = '#A6A6A6';

export default function RecordView({ navigation, initialTab = 'today' }) {
  const { height: windowHeight } = useWindowDimensions();
  const [tab, setTab] = useState(initialTab);
  const [history, setHistory] = useState(null);
  const [weekHistory, setWeekHistory] = useState(null); // 오늘 탭 아래 "이번 주에 ~" 문장용
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // 탭을 빠르게 바꿀 때 늦게 도착한 이전 응답은 버림
  const requestIdRef = useRef(0);

  const load = useCallback(async (period) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(false);

    try {
      const [main, week] = await Promise.all([
        fetchHistory(period),
        period === 'today' ? fetchHistory('week') : Promise.resolve(null),
      ]);
      if (requestId !== requestIdRef.current) return;

      setHistory(main);
      setWeekHistory(period === 'today' ? week : main);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      console.error('기록 조회 실패:', e);
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // 화면에 들어올 때마다, 탭이 바뀔 때마다 새로 불러오기
  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab])
  );

  const deleteAllRecords = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');

    try {
      // 되돌릴 수 없는 API라 실패해도 자동으로 다시 부르지 않음
      await resetFarmHistory();
    } catch (e) {
      console.error('기록 삭제 실패:', e);
      setDeleteError('지우지 못했어요. 잠시 후 다시 시도해 주세요');
      setDeleting(false);
      load(tab);
      return;
    }

    setDeleting(false);
    setDeleteDialogVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'S02' }] });
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('S03');
  };

  const currentTab = TABS.find(({ key }) => key === tab);

  let list = [];
  if (history) {
    if (tab === 'today') list = todayRows(history).map((row) => <TodayRow key={row.key} row={row} />);
    if (tab === 'week') list = weekRows(history).map((row) => <PeriodRow key={row.key} row={row} />);
    if (tab === 'all') list = monthRows(history).map((row) => <PeriodRow key={row.key} row={row} wideLabel />);
  }

  const footer =
    tab === 'all'
      ? summarySentence(history?.items ?? [], '지금까지')
      : summarySentence(weekHistory?.items ?? [], '이번 주에');

  let listContent;
  if (loading && !history) {
    listContent = <Text style={styles.emptyText}>불러오는 중...</Text>;
  } else if (loadError) {
    listContent = (
      <>
        <Text style={styles.emptyText}>기록을 불러오지 못했어요</Text>
        <AppButton title="다시 불러오기" variant="text" onPress={() => load(tab)} />
      </>
    );
  } else if (list.length > 0) {
    listContent = list;
  } else {
    listContent = <Text style={styles.emptyText}>아직 기록이 없어요</Text>;
  }

  return (
    <FarmSheetLayout farmHeight={Math.round(windowHeight * FARM_HEIGHT_RATIO)}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>기록</Text>

        <View style={styles.tabs}>
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{currentTab.summaryLabel}</Text>
          <Text style={styles.summaryValue}>{formatMinutes(totalMinutes(history))}</Text>
        </View>

        <View style={styles.list}>{listContent}</View>

        {footer && !loadError && (
          <View style={styles.footerCard}>
            <Text style={styles.footerText}>{footer}</Text>
          </View>
        )}

        <AppButton
          title="기록 모두 지우기"
          variant="text"
          onPress={() => {
            setDeleteError('');
            setDeleteDialogVisible(true);
          }}
        />
      </ScrollView>

      <DeleteRecordsDialog
        visible={deleteDialogVisible}
        loading={deleting}
        error={deleteError}
        onConfirm={deleteAllRecords}
        onCancel={() => !deleting && setDeleteDialogVisible(false)}
      />
    </FarmSheetLayout>
  );
}

function TodayRow({ row }) {
  return (
    <View style={styles.todayRow}>
      {CROP_ICONS[row.name] ? (
        <Image source={CROP_ICONS[row.name]} style={styles.cropImage} resizeMode="contain" />
      ) : (
        <View style={styles.cropIcon}>
          <Text style={styles.cropIconText}>작물</Text>
        </View>
      )}
      <Text style={styles.todayName}>
        {row.name} × {row.count}
      </Text>
      {row.minutes !== null && <Text style={styles.todayMinutes}>{formatMinutes(row.minutes)}</Text>}
    </View>
  );
}

function PeriodRow({ row, wideLabel = false }) {
  const text = row.detail ? `${formatMinutes(row.minutes)} · ${row.detail}` : formatMinutes(row.minutes);

  return (
    <View style={styles.periodRow}>
      <Text style={[styles.periodLabel, wideLabel && styles.periodLabelWide]}>
        {row.label}
      </Text>
      <Text style={[styles.periodText, row.rested && styles.periodTextRested]}>
        {row.rested ? '쉬어간 날' : text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    marginTop: -8,
  },

  backText: {
    fontSize: 32,
    fontWeight: '600',
    color: COLORS.black,
  },

  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black,
  },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },

  tab: {
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: COLORS.Gray,
  },

  tabActive: {
    backgroundColor: COLORS.black,
  },

  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.graytext,
  },

  tabTextActive: {
    color: COLORS.white,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.Gray,
  },

  summaryLabel: {
    fontSize: 14,
    color: COLORS.graytext,
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
  },

  list: {
    marginTop: 12,
    marginBottom: 12,
  },

  emptyText: {
    paddingVertical: 16,
    fontSize: 14,
    color: LIGHT_GRAY_TEXT,
    textAlign: 'center',
  },

  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },

  cropIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 10,
    backgroundColor: COLORS.Gray,
  },

  cropImage: {
    width: 44,
    height: 44,
    marginRight: 10,
  },

  cropIconText: {
    fontSize: 12,
    color: COLORS.graytext,
  },

  todayName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.black,
  },

  todayMinutes: {
    fontSize: 14,
    color: COLORS.graytext,
  },

  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
  },

  periodLabel: {
    width: 30,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.black,
  },

  periodLabelWide: {
    width: 64, // "2025년 11월"처럼 길어질 수 있어서
  },

  periodText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.graytext,
  },

  periodTextRested: {
    color: LIGHT_GRAY_TEXT,
  },

  footerCard: {
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.Gray,
  },

  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
});
