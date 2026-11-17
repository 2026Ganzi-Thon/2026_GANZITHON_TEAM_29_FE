// 작물 이름 뒤에 받침에 맞는 조사를 붙여주는 함수들
// 예) 당근 → "당근을", 토마토 → "토마토를" / 당근 → "당근이", 토마토 → "토마토가"

function hasFinalConsonant(word) {
  if (!word) return false;

  const code = word.charCodeAt(word.length - 1);

  // 한글 글자가 아니면 받침 없음으로 처리
  if (code < 0xac00 || code > 0xd7a3) return false;

  return (code - 0xac00) % 28 !== 0;
}

// 을/를
export function eulReul(word) {
  return word + (hasFinalConsonant(word) ? '을' : '를');
}

// 이/가
export function iGa(word) {
  return word + (hasFinalConsonant(word) ? '이' : '가');
}
