/**
 * 안전 모드 — 마이그레이션/무결성 실패 또는 저장소 초기화(부트스트랩) 실패 시 읽기 전용 안내
 * (E-15-1, STORAGE_MIGRATION_FAILED).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 *
 * RENDER-003 부차 UX: `migration.failedAt < 0` 은 `bootstrapSequence` 의 부트스트랩 단계
 * 예외 sentinel(-1) 이므로 스키마 버전 카피 대신 저장소 초기화 실패 카피로 분기한다.
 * `failedAt >= 0` 은 실제 마이그레이션 실패 버전이므로 기존 카피를 유지한다.
 */
import React from 'react';
import { Text, View } from 'react-native';
import type { MigrationRunResult } from '../../core/migration/runner.ts';

export function SafeModeScreen({ migration }: { migration: MigrationRunResult }) {
  const isBootstrapFailure = migration.failedAt !== undefined && migration.failedAt < 0;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 18 }}>데이터를 여는 중 문제가 발생했습니다</Text>
      {isBootstrapFailure ? (
        <Text>
          저장소를 초기화하지 못했습니다. 앱을 다시 실행하면 재시도합니다. 계속 실패하면
          지원팀에 문의하세요.
        </Text>
      ) : (
        <Text>
          스키마 업데이트에 실패했습니다 (v{migration.fromVersion} → 실패 지점 v{String(migration.failedAt)}).
          앱을 다시 실행하면 재시도합니다. 계속 실패하면 지원팀에 문의하세요.
        </Text>
      )}
    </View>
  );
}
