/**
 * ESLint 설정 — React Native 표준.
 * 설계 근거: document/architect/overview.md v1.1 (린트/포맷).
 * 코어(src/core)는 별도 규칙 없이 TS strict 로 유지, 셸(src/app, App.tsx)에 RN 규칙 적용.
 */
module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['node_modules/', 'android/', 'ios/', 'src/core/**/*.ts', 'tests/**'],
  overrides: [
    {
      files: ['src/app/**/*.{ts,tsx}', 'App.tsx', 'index.js'],
      rules: {
        'react-native/no-inline-styles': 'off',
      },
    },
  ],
};
