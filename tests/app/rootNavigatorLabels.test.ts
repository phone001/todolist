/**
 * 대시보드 탭 라벨 "오늘"→"오늘일정" 정적 검증 (F-10/F-16, P-72, AC-95, v1.18).
 * 대응: document/architect/logic.md v1.18 §16.2 "탭 라벨 설계".
 *
 * `RootNavigator.tsx` 는 react-native 의존 `.tsx` 파일이라 node:test 로 직접 import 할 수 없으므로
 * (tsconfig.json 도 `src/app/**\/*.tsx` 를 core typecheck 대상에서 제외한다), 기존
 * rootNavigatorIcons.test.ts 와 동일한 정적 grep 기법으로 소스 파일 내용을 읽어 검증한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT_NAVIGATOR_PATH = fileURLToPath(
  new URL('../../src/app/navigation/RootNavigator.tsx', import.meta.url),
);

test('v1.18: 대시보드 탭 Tab.Screen 의 title 은 "오늘일정" 이다', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  assert.match(
    src,
    /Tab\.Screen name=\{TAB_ROUTES\.Dashboard\} component=\{DashboardScreen\} options=\{\{\s*title:\s*'오늘일정'\s*\}\}/,
    'Dashboard Tab.Screen 의 options.title 이 "오늘일정" 이어야 한다',
  );
});

test('v1.18: TAB_FALLBACK_LABELS[TAB_ROUTES.Dashboard] 는 "오늘일정" 이다', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  assert.match(
    src,
    /\[TAB_ROUTES\.Dashboard\]:\s*'오늘일정'/,
    'TAB_FALLBACK_LABELS[TAB_ROUTES.Dashboard] 가 "오늘일정" 이어야 한다(E-16-1/AC-28 폴백 라벨)',
  );
});

test('v1.18: 실행 코드에 단독 라벨 리터럴 \'오늘\'(정체성 명칭) 잔존 참조가 없다', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  const codeOnly = src
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .join('\n');
  // title/라벨 리터럴 컨텍스트에서 '오늘' 단독 값(따옴표로 완전히 감싸인 2글자)이 남아있으면 안 된다.
  assert.ok(
    !/(?:title:|\]:)\s*'오늘'(?!일정)/.test(codeOnly),
    '실행 코드에 title/라벨 리터럴 "오늘"(정정 전 값) 잔존 참조가 없어야 한다',
  );
});

test('v1.18: 캘린더/통계/설정 탭 title 리터럴은 무변경', () => {
  const src = readFileSync(ROOT_NAVIGATOR_PATH, 'utf-8');
  assert.match(src, /name=\{TAB_ROUTES\.Calendar\}[^]*?title:\s*'캘린더'/);
  assert.match(src, /name=\{TAB_ROUTES\.Statistics\}[^]*?title:\s*'통계'/);
  assert.match(src, /name=\{TAB_ROUTES\.Settings\}[^]*?title:\s*'설정'/);
});
