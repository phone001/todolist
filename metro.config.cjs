/**
 * Metro 설정 (React Native 0.74).
 * 설계 근거: document/architect/overview.md v1.1 (RN 프로젝트 파일).
 *
 * 소스는 .ts/.tsx 를 사용한다. 코어(src/core)는 플랫폼 비의존이므로 그대로 번들된다.
 * .native.ts 파일은 네이티브 타깃 전용 어댑터다(Metro platform resolution 으로 선택).
 */
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json', 'native.ts'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
