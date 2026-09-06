/**
 * react-native-app-auth 기반 AuthGateway 어댑터 (네이티브 바인딩).
 * 설계 근거: document/architect/logic.md 9 (API 설계 9.1~9.3), 13.2/13.5, v1.1 §16.5.
 * 환경 제약: 라이브러리 의존 → 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 *
 * PKCE public client — client_secret 을 사용하지 않는다(13.5). 시스템 브라우저만 사용.
 * discovery URL / redirect scheme 는 빌드 환경에서 주입한다(리포지토리에 운영값 커밋 금지).
 */
import { authorize, refresh, revoke } from 'react-native-app-auth';
import type { AuthConfiguration } from 'react-native-app-auth';
import type { AuthGateway, TokenSet } from '../../../core/ports/gateways.ts';
import { toTokenSet, type AppAuthResult } from './tokens.ts';
import { mapAuthError } from '../errors.ts';

export interface AppAuthGatewayConfig {
  issuer: string; // discovery: `${issuer}/.well-known/openid-configuration`
  clientId: string; // 공개 값
  redirectUrl: string; // 앱 스킴 (todaywhat://oauthredirect 등)
  scopes?: string[];
  expectedAudience?: string;
}

export class AppAuthGateway implements AuthGateway {
  private readonly config: AuthConfiguration;
  private readonly issuer: string;
  private readonly expectedAudience?: string;

  constructor(cfg: AppAuthGatewayConfig) {
    this.issuer = cfg.issuer;
    this.expectedAudience = cfg.expectedAudience ?? cfg.clientId;
    this.config = {
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      redirectUrl: cfg.redirectUrl,
      scopes: cfg.scopes ?? ['openid', 'profile'],
      usePKCE: true,
      // client_secret 미지정 (public client).
    };
  }

  async authorize(): Promise<TokenSet> {
    try {
      const res = (await authorize(this.config)) as AppAuthResult;
      return toTokenSet(res, { expectedIssuer: this.issuer, expectedAudience: this.expectedAudience });
    } catch (err) {
      throw mapAuthError(err);
    }
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    try {
      const res = (await refresh(this.config, { refreshToken })) as AppAuthResult;
      // refresh 응답에 refreshToken 이 없으면 기존 값을 유지(회전 안 함).
      if (!res.refreshToken) res.refreshToken = refreshToken;
      return toTokenSet(res, { expectedIssuer: this.issuer, expectedAudience: this.expectedAudience });
    } catch (err) {
      throw mapAuthError(err);
    }
  }

  async revoke(token: string): Promise<void> {
    try {
      await revoke(this.config, { tokenToRevoke: token, sendClientId: true });
    } catch {
      // best-effort (logic 9.3) — 로컬 정리는 그대로 진행.
    }
  }
}
