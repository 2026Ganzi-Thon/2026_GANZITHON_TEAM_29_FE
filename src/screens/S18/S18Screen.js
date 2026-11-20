import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import AppTextInput from '../../components/common/AppTextInput';
import { COLORS } from '../../styles/colors';
import { getStartScreen, signIn } from '../../lib/auth';
import { authErrorMessage } from '../../lib/errors';

// S18 로그인
export default function S18Screen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 회원가입 화면에서 돌아올 때 안내 문구와 이메일을 받아서 보여 줌
  const notice = route.params?.notice;
  const signedUpEmail = route.params?.email;
  useEffect(() => {
    if (notice) setError(notice);
    if (signedUpEmail) setEmail(signedUpEmail);
  }, [notice, signedUpEmail]);

  const login = async () => {
    if (loading) return;

    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e, '로그인에 실패했어요. 잠시 후 다시 시도해 주세요'));
      setLoading(false);
      return;
    }

    let nextScreen = 'S03';
    try {
      nextScreen = await getStartScreen();
    } catch (e) {
      console.error('시작 화면 확인 실패:', e);
    }

    navigation.reset({ index: 0, routes: [{ name: nextScreen }] });
  };

  return (
    <FarmSheetLayout>
      <Text style={styles.title}>다시 만나서 반가워요</Text>

      <AppTextInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={styles.input}
      />
      <AppTextInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        returnKeyType="done"
        onSubmitEditing={login}
        style={styles.input}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <AppButton
        title={loading ? '로그인 중...' : '로그인'}
        onPress={login}
        disabled={loading}
        style={styles.loginButton}
      />
      <AppButton
        title="회원가입"
        variant="outline"
        onPress={() => navigation.navigate('S19')}
      />
    </FarmSheetLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 4,
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },

  input: {
    marginTop: 16,
  },

  error: {
    marginTop: 8,
    fontSize: 13,
    color: '#E5484D',
  },

  loginButton: {
    marginTop: 16,
    marginBottom: 16,
  },
});
