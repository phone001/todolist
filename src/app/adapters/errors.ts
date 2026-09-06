/**
 * 네이티브 어댑터 오류 → 공통 ErrorCode 매핑 (순수 함수).
 * 설계 근거: document/architect/logic.md 0.2 (오류 코드 체계), v1.1 §16.5 표 ("오류 → ErrorCodes 변환").
 *
 * 어댑터는 라이브러리별 예외를 여기서 도메인 오류 코드로 변환해 AppError 로 던진다.
 * UI 는 코드로 분기하고, 서비스 계층은 게이트웨이 실패를 격리한다.
 */
import { AppError, ErrorCodes } from '../../core/domain/errors.ts';
import type { PermissionStatus } from '../../core/ports/gateways.ts';

/** react-native-app-auth 오류 → GATEWAY_AUTH_*. 사용자 취소는 무해 코드. */
export function mapAuthError(err: unknown): AppError {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code ?? '';
  const cancelled =
    /cancel/i.test(message) ||
    code === 'authentication_canceled' ||
    code === 'org.openid.appauth.general error -3' ||
    code === 'USER_CANCELED';
  if (cancelled) {
    return new AppError(ErrorCodes.GATEWAY_AUTH_CANCELLED, '로그인이 취소되었습니다.');
  }
  return new AppError(ErrorCodes.GATEWAY_AUTH_FAILED, `인증에 실패했습니다: ${message}`);
}

/** react-native-calendar-events 오류 → 권한 거부 또는 게이트웨이 불가. */
export function mapCalendarError(err: unknown, permission?: PermissionStatus): AppError {
  if (permission === 'denied') {
    return new AppError(ErrorCodes.PERMISSION_CALENDAR_DENIED, '캘린더 접근 권한이 없습니다.');
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/permission|denied|not authorized|access/i.test(message)) {
    return new AppError(ErrorCodes.PERMISSION_CALENDAR_DENIED, '캘린더 접근 권한이 없습니다.');
  }
  return new AppError(ErrorCodes.GATEWAY_CALENDAR_UNAVAILABLE, `캘린더를 사용할 수 없습니다: ${message}`);
}

/** op-sqlite 오류 → STORAGE_*. 낙관적 갱신 충돌은 별도 코드. */
export function mapSqliteError(err: unknown, kind: 'read' | 'write' | 'migration' = 'write'): AppError {
  const message = err instanceof Error ? err.message : String(err);
  if (/stale|conflict|updated_at/i.test(message)) {
    return new AppError(ErrorCodes.STORAGE_STALE_WRITE, '다른 곳에서 먼저 수정되었습니다. 새로고침 후 다시 시도하세요.');
  }
  if (kind === 'read') {
    return new AppError(ErrorCodes.STORAGE_READ_FAILED, `데이터를 읽지 못했습니다: ${message}`);
  }
  if (kind === 'migration') {
    return new AppError(ErrorCodes.STORAGE_MIGRATION_FAILED, `마이그레이션에 실패했습니다: ${message}`);
  }
  return new AppError(ErrorCodes.STORAGE_TX_FAILED, `저장에 실패했습니다: ${message}`);
}

/** notifee 권한 상태 문자열 정규화. */
export function normalizePermission(value: unknown): PermissionStatus {
  if (value === true || value === 'granted' || value === 1 || value === 'authorized') return 'granted';
  if (value === false || value === 'denied' || value === 0 || value === 'blocked') return 'denied';
  return 'undetermined';
}
