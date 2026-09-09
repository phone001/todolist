/**
 * 대시보드 진행률 한 줄 (F-21, v1.11 재정의 — 구 `CountCards.tsx`) — 순수 프레젠테이션.
 * 과거·오늘: "M / N 완료" 텍스트 + 얇은 progress bar 1개(채움 = 완료율 P-07).
 * 미래(`isFuture`): "일정 N건"만 — progress bar·완료 수·완료율 숨김(P-52 / D-19(a) / AC-68).
 * 설계 근거: document/architect/logic.md v1.11 §7.1.2 / §16.3.3 영역 3 / §16.3.7,
 *            nfr.md v1.9 §15.6(색 비의존 진척 전달).
 *
 * 수치는 `DashboardService.getSummary(referenceDate)` 의 `total` / `done` 를 그대로 받는다.
 * 이 컴포넌트는 집계하지 않으며(P-47), 접이식 검색(F-22)에도 영향받지 않는다(P-49 / D-16).
 * `src/core`·서비스·`bindings.ts` 무의존 — props 로만 데이터를 수신한다.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { progressFillRatio } from '../screens/dashboardViewModel.ts';

export interface ProgressLineProps {
  total: number;
  done: number;
  /** 기준 날짜가 오늘보다 미래이면 true — bar·완료 수를 숨기고 "일정 N건"만 표시한다. */
  isFuture: boolean;
  testID?: string;
}

export function ProgressLine({ total, done, isFuture, testID }: ProgressLineProps) {
  if (isFuture) {
    const label = `일정 ${total}건`;
    return (
      <View style={styles.wrap} testID={testID}>
        <Text style={styles.text} accessibilityLabel={label}>
          {label}
        </Text>
      </View>
    );
  }

  const ratio = progressFillRatio(total, done);
  return (
    <View
      style={styles.wrap}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      {/* 색각·저대비 대응: bar 색뿐 아니라 인접 텍스트로도 진척 전달(NFR-08, nfr §15.6) */}
      <Text style={styles.text}>{`${done} / ${total} 완료`}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { flex: ratio }]} />
        <View style={{ flex: 1 - ratio }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 6,
  },
  text: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  track: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ececec',
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});
