import { supabase } from './supabase';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password, nickname) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });

  if (error) {
    // 응답이 유실됐어도 가입은 됐을 수 있으니, 다시 가입하기 전에 세션부터 확인
    const { data: restored } = await supabase.auth.getSession();
    if (restored.session) return restored.session;
    throw error;
  }

  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// 로그인 상태에 따라 처음 보여줄 화면
// 로그인 안 됨 → S18 / 첫 방문 안내 전 → S01 / 기록·작물 없음 → S02 / 그 외 → S03
export async function getStartScreen() {
  const session = await getSession();
  if (!session) return 'S18';

  const { data: profiles, error: profileError } = await supabase.rpc('get_my_profile');
  if (profileError) throw profileError;

  const profile = profiles?.[0];
  if (!profile?.onboarded) return 'S01';

  const [farmResult, historyResult] = await Promise.all([
    supabase.rpc('get_my_farm'),
    supabase.rpc('get_focus_history', { p_period: 'all' }),
  ]);
  if (farmResult.error) throw farmResult.error;
  if (historyResult.error) throw historyResult.error;

  const hasCrop = (farmResult.data ?? []).some((plot) => plot.farm_status !== 'empty');
  const { seed_count, harvest_count } = historyResult.data?.summary ?? {};
  const hasHistory = (seed_count ?? 0) + (harvest_count ?? 0) > 0;

  return hasCrop || hasHistory ? 'S03' : 'S02';
}
