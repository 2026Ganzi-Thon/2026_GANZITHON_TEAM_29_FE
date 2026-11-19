import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { getStartScreen } from '../lib/auth';
import { SettingsProvider } from '../components/settings/SettingsContext';

import S01Screen from '../screens/S01/S01Screen';
import S02Screen from '../screens/S02/S02Screen';
import S03Screen from '../screens/S03/S03Screen';
import S04Screen from '../screens/S04/S04Screen';
import S05Screen from '../screens/S05/S05Screen';
import S06Screen from '../screens/S06/S06Screen';
import S07Screen from '../screens/S07/S07Screen';
import S08Screen from '../screens/S08/S08Screen';
import S09Screen from '../screens/S09/S09Screen';
import S10Screen from '../screens/S10/S10Screen';
import S11Screen from '../screens/S11/S11Screen';
import S12Screen from '../screens/S12/S12Screen';
import S13Screen from '../screens/S13/S13Screen';
import S14Screen from '../screens/S14/S14Screen';
import S15Screen from '../screens/S15/S15Screen';
import S16Screen from '../screens/S16/S16Screen';
import S17Screen from '../screens/S17/S17Screen';
import S18Screen from '../screens/S18/S18Screen';
import S19Screen from '../screens/S19/S19Screen';

const Stack = createNativeStackNavigator();

// 개발할 때 특정 화면부터 보고 싶으면 화면 이름을 넣기 (예: 'S10'). 커밋할 땐 null
const DEV_START_SCREEN = null;

export const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const [startScreen, setStartScreen] = useState(DEV_START_SCREEN);

  useEffect(() => {
    if (DEV_START_SCREEN) return;

    getStartScreen()
      .then(setStartScreen)
      .catch((error) => {
        console.error('시작 화면 확인 실패:', error);
        setStartScreen('S18');
      });
  }, []);

  // 어느 화면에서든 로그아웃되면 로그인 화면으로
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'S18' }] });
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!startScreen) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#212121" />
      </View>
    );
  }

  return (
    <SettingsProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={startScreen}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="S01" component={S01Screen} />
          <Stack.Screen name="S02" component={S02Screen} />
          <Stack.Screen name="S03" component={S03Screen} />
          <Stack.Screen name="S04" component={S04Screen} />
          <Stack.Screen name="S05" component={S05Screen} />
          <Stack.Screen name="S06" component={S06Screen} />
          <Stack.Screen name="S07" component={S07Screen} />
          <Stack.Screen name="S08" component={S08Screen} />
          <Stack.Screen name="S09" component={S09Screen} />
          <Stack.Screen name="S10" component={S10Screen} />
          <Stack.Screen name="S11" component={S11Screen} />
          <Stack.Screen name="S12" component={S12Screen} />
          <Stack.Screen name="S13" component={S13Screen} />
          <Stack.Screen name="S14" component={S14Screen} />
          <Stack.Screen name="S15" component={S15Screen} />
          <Stack.Screen name="S16" component={S16Screen} />
          <Stack.Screen name="S17" component={S17Screen} />
          <Stack.Screen name="S18" component={S18Screen} />
          <Stack.Screen name="S19" component={S19Screen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ACD066',
  },
});
