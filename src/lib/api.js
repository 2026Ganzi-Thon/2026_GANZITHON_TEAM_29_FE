import { supabase } from './supabase';
import { normalizeBackendError } from './errors';

// supabase.rpc 호출 + 오류를 공통 코드(UNAUTHENTICATED, INVALID_STATE 등)로 바꿔서 던짐
export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    const { data: sessionData } = await supabase.auth.getSession();
    const code = normalizeBackendError(error, !!sessionData.session);
    const wrapped = new Error(code);
    wrapped.code = code;
    wrapped.original = error;
    throw wrapped;
  }

  return data;
}
