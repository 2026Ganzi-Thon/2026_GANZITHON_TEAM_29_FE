import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import FarmSheetLayout from '../common/FarmSheetLayout';
import AppButton from '../common/AppButton';
import DeleteRecordsDialog from './DeleteRecordsDialog';
import { COLORS } from '../../styles/colors';
import { formatMinutes } from '../../utils/time';
import { MOCK_ALL, MOCK_TODAY, MOCK_WEEK } from '../../data/mockRecords';

// 기록 화면 공통 (S14 오늘 / S15 이번 주 / S15-1 전체)
// 세 화면은 탭만 다르고 구성이 같아서 하나로 만들고, 탭을 누르면 화면 안에서 내용만 바뀜
// [기록 모두 지우기] → S16 확인 창(DeleteRecordsDialog)이 이 화면 위에 뜸

const TABS = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번 주' },
  { key: 'all', label: '전체' },
];

const LIGHT_GRAY_TEXT = '#A6A6A6'; // "쉬어간 날" 글자색

// [{name:'당근', count:2}, ...] 여러 개를 작물별로 합치기
function mergeCrops(rows) {
  const counts = {};
  rows.forEach((row) => {
    row.crops.forEach(({ name, count }) => {
      counts[name] = (counts[name] ?? 0) + count;
    });
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// "당근 2개, 토마토 1개 외 4개" 처럼 많이 키운 2개만 보여주고 나머지는 "외 N개"
function describeCrops(crops) {
  if (crops.length === 0) return null;

  const top = crops.slice(0, 2).map(({ name, count }) => `${name} ${count}개`);
  const restCount = crops.slice(2).reduce((sum, { count }) => sum + count, 0);

  return restCount > 0 ? `${top.join(', ')} 외 ${restCount}개` : top.join(', ');
}

// "당근 3, 토마토 2" (목록 한 줄용)
function cropsInline(crops) {
  return crops.map(({ name, count }) => `${name} ${count}`).join(', ');
}

export default function RecordView({ navigation, initialTab = 'today' }) {
  const [tab, setTab] = useState(initialTab);

  // TODO: 백엔드 연결되면 서버에서 받아온 기록으로 바꾸기
  const [records, setRecords] = useState({
    today: MOCK_TODAY,
    week: MOCK_WEEK,
    all: MOCK_ALL,
  });

  // S16 삭제 확인 창 보이기/숨기기
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const deleteAllRecords = () => {
    // TODO: 서버에서 기록 삭제하는 API 호출
    setRecords({
      today: [],
      week: records.week.map((row) => ({ ...row, minutes: 0, crops: [] })), // 요일은 남기고 전부 "쉬어간 날"
      all: [],
    });
    setDeleteDialogVisible(false);
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('S03');
  };

  // 탭마다 [요약 카드 제목, 합계 시간, 목록, 아래 한 줄 요약]
  let summaryLabel;
  let totalMinutes;
  let list;
  let footer;

  const { today, week, all } = records;

  if (tab === 'today') {
    summaryLabel = '오늘 키운 시간';
    totalMinutes = today.reduce((sum, item) => sum + item.minutes, 0);
    list = today.map((item, i) => <TodayRow key={i} item={item} />);
    const weekText = describeCrops(mergeCrops(week));
    footer = weekText ? `이번 주에 ${weekText}를 키웠어요` : null;
  } else if (tab === 'week') {
    summaryLabel = '이번 주 키운 시간';
    totalMinutes = week.reduce((sum, row) => sum + row.minutes, 0);
    list = week.map((row) => <PeriodRow key={row.label} row={row} />);
    const weekText = describeCrops(mergeCrops(week));
    footer = weekText ? `이번 주에 ${weekText}를 키웠어요` : null;
  } else {
    summaryLabel = '총 키운 시간';
    totalMinutes = all.reduce((sum, row) => sum + row.minutes, 0);
    list = all.map((row) => <PeriodRow key={row.label} row={row} wideLabel />);
    const allText = describeCrops(mergeCrops(all));
    footer = allText ? `지금까지 ${allText}를 키웠어요` : null;
  }

  return (
    // 기록이 길어서 3D 농장을 작게 표시
    <FarmSheetLayout farmHeight={230}>
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
          <Text style={styles.summaryLabel}>{summaryLabel}</Text>
          <Text style={styles.summaryValue}>{formatMinutes(totalMinutes)}</Text>
        </View>

        <View style={styles.list}>
          {list.length > 0 ? list : <Text style={styles.emptyText}>아직 기록이 없어요</Text>}
        </View>

        {footer && (
          <View style={styles.footerCard}>
            <Text style={styles.footerText}>{footer}</Text>
          </View>
        )}

        <AppButton
          title="기록 모두 지우기"
          variant="text"
          onPress={() => setDeleteDialogVisible(true)}
        />
      </ScrollView>

      <DeleteRecordsDialog
        visible={deleteDialogVisible}
        onConfirm={deleteAllRecords}
        onCancel={() => setDeleteDialogVisible(false)}
      />
    </FarmSheetLayout>
  );
}

// 오늘 탭 한 줄: [작물 아이콘] 새싹채소 × 1 ........ 10분
function TodayRow({ item }) {
  return (
    <View style={styles.todayRow}>
      {/* TODO: 작물 아이콘 이미지 나오면 교체 */}
      <View style={styles.cropIcon}>
        <Text style={styles.cropIconText}>작물</Text>
      </View>
      <Text style={styles.todayName}>
        {item.crop} × {item.count}
      </Text>
      <Text style={styles.todayMinutes}>{formatMinutes(item.minutes)}</Text>
    </View>
  );
}

// 이번 주 / 전체 탭 한 줄: 월  40분 · 당근 2   (없으면 "쉬어간 날")
function PeriodRow({ row, wideLabel = false }) {
  const rested = row.crops.length === 0;

  return (
    <View style={styles.periodRow}>
      <Text style={[styles.periodLabel, wideLabel && styles.periodLabelWide]}>
        {row.label}
      </Text>
      <Text style={[styles.periodText, rested && styles.periodTextRested]}>
        {rested ? '쉬어간 날' : `${formatMinutes(row.minutes)} · ${cropsInline(row.crops)}`}
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

  // 오늘 탭
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

  // 이번 주 / 전체 탭
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
    width: 48, // "11월"처럼 글자가 길어서
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
