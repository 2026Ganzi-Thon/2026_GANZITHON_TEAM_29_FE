import { rpc } from './api';

// 다 자란(ripe) 작물 수확 → { harvest_id, session_id, plot_id, crop_id, focused_seconds, harvested_at, auto_harvested }
// 같은 세션으로 다시 불러도 처음 수확 결과를 돌려줌
export function harvestCrop(sessionId) {
  return rpc('harvest_crop', { p_session_id: sessionId });
}

// 오늘 한 줄 저장 → { saved, guidance_required }
// guidance_required가 true면 서버가 저장하지 않음
export function saveHarvestNote(harvestId, note) {
  return rpc('save_harvest_note', { p_harvest_id: harvestId, p_note: note });
}

// 5분 휴식 시작 → { rest_ends_at, server_now }
export function startRest(harvestId) {
  return rpc('start_rest', { p_harvest_id: harvestId });
}

export function harvestErrorMessage(error) {
  switch (error?.code) {
    case 'NOT_RIPE':
      return '아직 다 자라지 않았어요';
    case 'SESSION_NOT_FOUND':
    case 'HARVEST_NOT_FOUND':
      return '수확 정보를 찾을 수 없어요';
    case 'NOTE_TOO_LONG':
      return '50자 이내로 적어 주세요';
    case 'INVALID_STATE':
      return '지금은 쉬어가기를 시작할 수 없어요';
    case 'UNAUTHENTICATED':
      return '다시 로그인해 주세요';
    default:
      return '잠시 후 다시 시도해 주세요';
  }
}
