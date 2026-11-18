// RPC 오류 → 공통 코드 (BE docs/deployment/frontend-handoff.md 기준)
export function normalizeBackendError(error, hasSession) {
  if (!error) return null;
  if (['PGRST301', 'PT401'].includes(error.code)) return 'UNAUTHENTICATED';
  if (error.code === '42501' && !hasSession) return 'UNAUTHENTICATED';
  if (error.code === '22023') return 'INVALID_INPUT';
  if (error.code === 'PT400') return error.details || 'INVALID_INPUT';
  if (error.code === 'PT404') return error.details || 'NOT_FOUND';
  if (error.code === 'PT409') return error.details || 'INVALID_STATE';
  return 'UNKNOWN';
}

function isNetworkError(error) {
  return error?.name === 'AuthRetryableFetchError' || error?.status === 0;
}

// 로그인·회원가입 오류 → 화면에 보여줄 문구
export function authErrorMessage(error, fallback) {
  if (isNetworkError(error)) return '인터넷 연결을 확인해 주세요';

  switch (error?.code) {
    case 'invalid_credentials':
      return '이메일 또는 비밀번호가 맞지 않아요';
    case 'user_already_exists':
    case 'email_exists':
      return '이미 가입된 이메일이에요';
    case 'weak_password':
      return '비밀번호를 더 길게 만들어 주세요';
    case 'email_address_invalid':
    case 'validation_failed':
      return '이메일 형식이 올바르지 않아요';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return '요청이 많아요. 잠시 후 다시 시도해 주세요';
    default:
      return fallback;
  }
}
