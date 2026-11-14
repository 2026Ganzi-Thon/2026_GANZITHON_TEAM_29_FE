import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function S09Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>S09 Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});