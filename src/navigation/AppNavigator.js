import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../styles/colors';

import DevToolsModal from '../components/common/DevToolsModal';

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

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const checkInitialRoute = async () => {
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken) {
          setInitialRoute('S18');
          return;
        }

        const hasOnboarded = await AsyncStorage.getItem('settings_onboarded');
        const hasRecords = await AsyncStorage.getItem('userFarmRecords');

        if (!hasOnboarded || !hasRecords) {
          setInitialRoute('S01');
        } else {
          setInitialRoute('S03');
        }
      } catch (error) {
        setInitialRoute('S18');
      }
    };

    checkInitialRoute();
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.black} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
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

      {__DEV__ && (
        <DevToolsModal 
          navigation={{
            reset: (state) => navigationRef.current?.reset(state),
            navigate: (name) => navigationRef.current?.navigate(name)
          }} 
        />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
});