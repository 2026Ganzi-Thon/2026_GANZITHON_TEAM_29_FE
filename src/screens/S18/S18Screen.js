import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import AppTextInput from '../../components/common/AppTextInput';
import { COLORS } from '../../styles/colors';

// S18 로그인
export default function S18Screen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const login = async () => {
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요');
      return;
    }

    setError('');

    // TODO: Supabase 로그인 연결, 실패하면 setError('이메일 또는 비밀번호가 맞지 않아요')
    // TODO: 기록이 없으면 S02로
    navigation.reset({ index: 0, routes: [{ name: 'S03' }] });
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

      <AppButton title="로그인" onPress={login} style={styles.loginButton} />
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
