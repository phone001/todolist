/**
 * V-60: 캘린더 탭 아이콘 교체 정적 검증 (F-16, P-71, AC-94).
 * 대응: document/architect/logic.md v1.17 §16.2, nfr.md §9 V-60.
 *
 * `RootNavigator.tsx` 는 react-native 의존 `.tsx` 파일이라 node:test 로 직접 import 할 수 없으므로
 * (tsconfig.json 도 `src/app/**\/*.tsx` 를 core typecheck 대상에서 제외한다), nfr.md V-60 이 명시한
 * "정적 grep/코드 리뷰" 방식대로 소스 파일 내용을 읽어 검증한다(securityLogging.test.ts 와 동일 기법).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT_NAVIGATOR_PATH = fileURLToPath(
  new URL('../../src/app/navigation/RootNavigator.tsx', import.meta.url),
);

test('V-60: RootNavigator 는 캘린더 탭 아이콘으로 calendar.png 를 require 한다', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  assert.match(
    src,
    /\[TAB_ROUTES\.Calendar\]:\s*require\('\.\.\/\.\.\/assets\/icons\/calendar\.png'\)/,
    'TAB_ICONS[TAB_ROUTES.Calendar] 가 calendar.png 를 require 해야 한다',
  );
});

test('V-60: RootNavigator 코드에 goal.png 잔존 참조가 없다', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  const codeOnly = src
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .join('\n');
  assert.ok(!codeOnly.includes('goal.png'), '실행 코드에 goal.png 참조가 남아있으면 안 된다(주석 제외)');
});

test('V-60: 나머지 3개 탭(todo/statistics/settings) require 경로 문자열은 무변경', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  assert.match(src, /\[TAB_ROUTES\.Dashboard\]:\s*require\('\.\.\/\.\.\/assets\/icons\/todo\.png'\)/);
  assert.match(src, /\[TAB_ROUTES\.Statistics\]:\s*require\('\.\.\/\.\.\/assets\/icons\/statistics\.png'\)/);
  assert.match(src, /\[TAB_ROUTES\.Settings\]:\s*require\('\.\.\/\.\.\/assets\/icons\/settings\.png'\)/);
});
