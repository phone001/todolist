/**
 * OAuth 토큰 매핑/만료 계산 (순수 함수).
 * 설계 근거: document/architect/logic.md 9 (AuthService, API 설계 9.1~9.3), 13.4 (토큰은 Keychain only),
 *           v1.1 §16.5 (AppAuthGateway / KeychainTokenStore).
 */
import type { TokenSet } from '../../../core/ports/gateways.ts';
import { base64UrlToUtf8 } from '../base64.ts';

/**
 * Keychain 항목 참조 키(= service 이름). AuthService 가 TokenStore.save(ref, ...) 에 쓰는 값과 일치해야 한다.
 * DB(account_link.token_ref)에는 이 문자열만 저장하고 토큰 값은 저장하지 않는다(V-14, V-24).
 */
export const ACCOUNT_TOKEN_REF = 'account.tokens';

/** react-native-app-auth `authorize()` / `refresh()` 결과의 느슨한 형태. */
export interface AppAuthResult {
  accessToken?: unknown;
  refreshToken?: unknown;
  accessTokenExpirationDate?: unknown; // ISO 문자열
  idToken?: unknown;
  tokenType?: unknown;
  additionalParameters?: Record<string, unknown> | null;
}

export interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  name?: string;
  exp?: number;
}

function parseExpiration(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** JWT payload 만 base64url 디코드 (서명 검증은 라이브러리/서버 몫). 실패 시 null. */
export function decodeIdTokenClaims(idToken: unknown): IdTokenClaims | null {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = base64UrlToUtf8(parts[1]);
    const claims = JSON.parse(json) as IdTokenClaims;
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}

export class AuthResponseError extends Error {}

/**
 * app-auth 결과 → 코어 `TokenSet`.
 * - accessToken/refreshToken 이 비면 예외(호출부가 mapAuthError 로 감싼다).
 * - provider/subject/displayName 은 id_token 클레임에서 최소 추출.
 * - expectedIssuer/expectedAudience 가 주어지면 iss/aud 를 앱에서도 확인(13.2).
 */
export function toTokenSet(
  result: AppAuthResult,
  opts: { expectedIssuer?: string; expectedAudience?: string } = {},
): TokenSet {
  const accessToken = typeof result.accessToken === 'string' ? result.accessToken : '';
  const refreshToken = typeof result.refreshToken === 'string' ? result.refreshToken : '';
  if (!accessToken || !refreshToken) {
    throw new AuthResponseError('토큰 응답이 불완전합니다.');
  }

  const claims = decodeIdTokenClaims(result.idToken);
  if (claims) {
    if (opts.expectedIssuer && claims.iss && claims.iss !== opts.expectedIssuer) {
      throw new AuthResponseError('id_token 발급자(iss)가 일치하지 않습니다.');
    }
    if (opts.expectedAudience && claims.aud) {
      const audOk = Array.isArray(claims.aud)
        ? claims.aud.includes(opts.expectedAudience)
        : claims.aud === opts.expectedAudience;
      if (!audOk) throw new AuthResponseError('id_token 대상(aud)이 일치하지 않습니다.');
    }
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: parseExpiration(result.accessTokenExpirationDate),
    provider: claims?.iss,
    subject: claims?.sub,
    displayName: claims?.name,
  };
}

/** 만료 임박 여부 — skewMs(기본 60s) 안이면 갱신 필요(logic 9 ensureFreshToken). */
export function isAccessTokenExpiring(expiresAt: number, now: number, skewMs = 60_000): boolean {
  return expiresAt - now <= skewMs;
}
