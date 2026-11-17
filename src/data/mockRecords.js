// 기록 화면(S14, S15, S15-1)용 임시 데이터
// TODO: 백엔드 API 연결되면 이 파일 대신 서버에서 받아온 값으로 바꾸기


// 오늘 (S14)
export const MOCK_TODAY = [
  { crop: '새싹채소', count: 1, minutes: 10 },
  { crop: '당근', count: 1, minutes: 20 },
  { crop: '꼬마 딸기', count: 1, minutes: 15 },
  { crop: '씨앗', count: 1, minutes: 3 }, // 중간에 멈춰서 씨앗으로 남은 것
];

// 이번 주 (S15) · 월~일 순서, 키운 게 없으면 crops가 빈 배열 → "쉬어간 날"
export const MOCK_WEEK = [
  { label: '월', minutes: 40, crops: [{ name: '당근', count: 2 }] },
  { label: '화', minutes: 60, crops: [{ name: '토마토', count: 1 }] },
  { label: '수', minutes: 0, crops: [] },
  { label: '목', minutes: 45, crops: [{ name: '옥수수', count: 1 }] },
  {
    label: '금',
    minutes: 25,
    crops: [
      { name: '꼬마 딸기', count: 1 },
      { name: '새싹채소', count: 1 },
    ],
  },
  { label: '토', minutes: 30, crops: [{ name: '딸기', count: 1 }] },
  { label: '일', minutes: 0, crops: [] },
];

// 전체 (S15-1) · 달별 합계, 최근 달부터
export const MOCK_ALL = [
  {
    label: '11월',
    minutes: 260,
    crops: [
      { name: '당근', count: 3 },
      { name: '토마토', count: 2 },
    ],
  },
  {
    label: '10월',
    minutes: 330,
    crops: [
      { name: '당근', count: 5 },
      { name: '딸기', count: 3 },
      { name: '옥수수', count: 1 },
    ],
  },
  {
    label: '9월',
    minutes: 160,
    crops: [
      { name: '새싹채소', count: 4 },
      { name: '딸기', count: 1 },
    ],
  },
];
