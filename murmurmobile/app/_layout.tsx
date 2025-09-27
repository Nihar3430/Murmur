// app/_layout.tsx

import { Video, ResizeMode } from 'expo-av';
import { StyleSheet, View } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <View style={splashVideoStyles.container}>
      <Video
        source={require('../constants/Murmur Intro Final.mp4')}
        style={splashVideoStyles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        onPlaybackStatusUpdate={status => {
          if (status && 'didJustFinish' in status && (status as any).didJustFinish) {
            onFinish();
          }
        }}
      />
    </View>
  );
}

const splashVideoStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});

export default function RootLayout() {
  const [showSplash, setShowSplash] = React.useState(true);

  // Splash screen will hide only after video finishes

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      {/* Overlay the system bars so your screen paints edge-to-edge */}
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1C1C1C' }, // fallback bg
        }}
      />
    </>
  );
}
