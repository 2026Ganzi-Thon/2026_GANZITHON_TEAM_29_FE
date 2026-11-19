import { rpc } from './api';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function fetchHistory(period) {
  return rpc('get_focus_history', { p_period: period });
}

export async function resetFarmHistory() {
  const data = await rpc('reset_farm_history');
  if (data?.success !== true) throw new Error('RESET_FAILED');
}

const toMinutes = (seconds) => Math.floor((seconds ?? 0) / 60);

// 'YYYY-MM-DD' → 요일 (시간대 영향 없이 날짜만으로 계산)
function weekdayOf(recordDate) {
  const [y, m, d] = recordDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// 백엔드가 작물별 정보(crops)를 아직 안 주면 null
function cropsOf(item) {
  return Array.isArray(item.crops) ? item.crops : null;
}

function mergeCrops(items) {
  const byName = {};
  items.forEach((item) => {
    (cropsOf(item) ?? []).forEach((crop) => {
      const prev = byName[crop.crop_name] ?? { name: crop.crop_name, count: 0, seconds: 0 };
      prev.count += crop.grown_count ?? 0;
      prev.seconds += crop.focused_seconds ?? 0;
      byName[crop.crop_name] = prev;
    });
  });
  return Object.values(byName)
    .filter((crop) => crop.count > 0)
    .sort((a, b) => b.count - a.count);
}

// 당근 2개, 토마토 1개 외 4개
function describeCrops(crops) {
  if (crops.length === 0) return null;
  const top = crops.slice(0, 2).map(({ name, count }) => `${name} ${count}개`);
  const rest = crops.slice(2).reduce((sum, { count }) => sum + count, 0);
  return rest > 0 ? `${top.join(', ')} 외 ${rest}개` : top.join(', ');
}

function sum(items, key) {
  return items.reduce((total, item) => total + (item[key] ?? 0), 0);
}

// 한 줄 설명: 작물 정보가 있으면 "당근 2, 토마토 1", 없으면 "수확 2 · 씨앗 1"
function rowDetail(items) {
  const hasCropInfo = items.some((item) => cropsOf(item));
  if (hasCropInfo) {
    return mergeCrops(items)
      .map(({ name, count }) => `${name} ${count}`)
      .join(', ');
  }
  const parts = [];
  const harvest = sum(items, 'harvest_count');
  const seed = sum(items, 'seed_count');
  if (harvest > 0) parts.push(`수확 ${harvest}`);
  if (seed > 0) parts.push(`씨앗 ${seed}`);
  return parts.join(' · ');
}

function isRestDay(items) {
  return sum(items, 'focused_seconds') === 0 && sum(items, 'seed_count') === 0 && sum(items, 'harvest_count') === 0;
}

export function summarySentence(items, prefix) {
  const cropText = describeCrops(mergeCrops(items));
  if (cropText) return `${prefix} ${cropText}를 키웠어요`;

  const harvest = sum(items, 'harvest_count');
  return harvest > 0 ? `${prefix} 작물 ${harvest}개를 수확했어요` : null;
}

// 오늘 탭 목록: [{ key, name, count, minutes }]
export function todayRows(history) {
  const items = history?.items ?? [];
  const hasCropInfo = items.some((item) => cropsOf(item));

  if (hasCropInfo) {
    const rows = mergeCrops(items).map((crop) => ({
      key: crop.name,
      name: crop.name,
      count: crop.count,
      minutes: toMinutes(crop.seconds),
    }));
    const seedCount = items.flatMap((item) => cropsOf(item) ?? []).reduce((s, c) => s + (c.seed_count ?? 0), 0);
    if (seedCount > 0) rows.push({ key: 'seed', name: '씨앗', count: seedCount, minutes: null });
    return rows;
  }

  // 작물 이름이 아직 없을 때
  const rows = [];
  const harvest = sum(items, 'harvest_count');
  const seed = sum(items, 'seed_count');
  if (harvest > 0) rows.push({ key: 'harvest', name: '수확한 작물', count: harvest, minutes: null });
  if (seed > 0) rows.push({ key: 'seed', name: '씨앗', count: seed, minutes: null });
  return rows;
}

// 이번 주 탭 목록: [{ key, label, minutes, detail, rested }]
export function weekRows(history) {
  return (history?.items ?? []).map((item) => ({
    key: item.record_date,
    label: weekdayOf(item.record_date),
    minutes: toMinutes(item.focused_seconds),
    detail: rowDetail([item]),
    rested: isRestDay([item]),
  }));
}

// 전체 탭 목록: 달별로 묶어서 최근 달부터
export function monthRows(history) {
  const items = history?.items ?? [];
  const thisYear = new Date().getFullYear();
  const groups = {};

  items.forEach((item) => {
    const month = item.record_date.slice(0, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(item);
  });

  return Object.keys(groups)
    .sort()
    .reverse()
    .map((month) => {
      const [y, m] = month.split('-').map(Number);
      const monthItems = groups[month];
      return {
        key: month,
        label: y === thisYear ? `${m}월` : `${y}년 ${m}월`,
        minutes: toMinutes(sum(monthItems, 'focused_seconds')),
        detail: rowDetail(monthItems),
        rested: isRestDay(monthItems),
      };
    });
}

export function totalMinutes(history) {
  return toMinutes(history?.summary?.focused_seconds);
}
