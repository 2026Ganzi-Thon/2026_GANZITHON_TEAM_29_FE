import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import FarmSheetLayout from '../../components/common/FarmSheetLayout';
import AppButton from '../../components/common/AppButton';
import AppTextInput from '../../components/common/AppTextInput';
import { COLORS } from '../../styles/colors';

// S19 회원가입 (이메일, 비밀번호, 닉네임)
export default function S19Screen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const signUp = async () => {
    if (!email.trim() || !password || !nickname.trim()) {
      setError('모든 칸을 입력해 주세요');
      return;
    }
    if (!email.includes('@')) {
      setError('이메일 형식이 올바르지 않아요');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요');
      return;
    }

    setError('');

    // TODO: Supabase 회원가입 + profiles.nickname 저장
    navigation.reset({ index: 0, routes: [{ name: 'S01' }] });
  };

  const backToLogin = () => {
    navigation.popTo('S18');
  };

  return (
    <FarmSheetLayout>
      <Text style={styles.title}>집중농장을 시작해요</Text>

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
        autoComplete="new-password"
        style={styles.input}
      />
      <AppTextInput
        placeholder="닉네임"
        value={nickname}
        onChangeText={setNickname}
        maxLength={12}
        returnKeyType="done"
        onSubmitEditing={signUp}
        style={styles.input}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <AppButton title="가입하기" onPress={signUp} style={styles.signUpButton} />
      <AppButton title="로그인으로 돌아가기" variant="outline" onPress={backToLogin} />
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

  signUpButton: {
    marginTop: 16,
    marginBottom: 16,
  },
});
