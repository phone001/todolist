/**
 * 계정 연동 (OAuth 2.0 + PKCE, D-01=(c)).
 * 설계 근거: document/architect/logic.md 9, 13.2. F-12, 정책 P-13/P-14. AC-20, AC-21, V-13, V-14.
 *
 * 보안: 액세스/리프레시 토큰은 TokenStore(OS 보안 저장소)에만 저장한다.
 *       AccountRepository(=DB) 에는 참조 키(tokenRef)와 비민감 식별자만 기록한다.
 */
import { AppError, ErrorCodes } from '../domain/errors.ts';
import type { Clock } from '../domain/clock.ts';
import type { AccountLink } from '../domain/types.ts';
import type { AccountRepository } from '../ports/repositories.ts';
import type { AuthGateway, Logger, TokenStore } from '../ports/gateways.ts';

const TOKEN_REF = 'account.tokens';
/** 액세스 토큰 만료 이 시간 이내면 갱신 시도. */
const REFRESH_SKEW_MS = 60_000;

export interface AuthServiceDeps {
  clock: Clock;
  auth: AuthGateway;
  tokenStore: TokenStore;
  account: AccountRepository;
  logger: Logger;
}

export class AuthService {
  private readonly d: AuthServiceDeps;

  constructor(deps: AuthServiceDeps) {
    this.d = deps;
  }

  getStatus(): Promise<AccountLink> {
    return this.d.account.get();
  }

  /** F-12 연동. 실패/취소는 로컬 전용 모드를 유지한다(E-12-1). */
  async link(): Promise<AccountLink> {
    let tokens;
    try {
      tokens = await this.d.auth.authorize();
    } catch (err) {
      this.d.logger.log('warn', 'auth.link.failed', { error: String(err) });
      throw new AppError(ErrorCodes.GATEWAY_AUTH_FAILED, '계정 연동에 실패했습니다.');
    }

    await this.d.tokenStore.save(TOKEN_REF, tokens);
    const link: AccountLink = {
      provider: tokens.provider ?? null,
      subject: tokens.subject ?? null,
      displayName: tokens.displayName ?? null,
      linkedAt: this.d.clock.now(),
      tokenRef: TOKEN_REF,
      state: 'LINKED',
    };
    await this.d.account.set(link);
    this.d.logger.metric('auth.link');
    return link;
  }

  /** F-12 해제. 로컬 일정 데이터는 건드리지 않는다(P-14, AC-21). */
  async unlink(): Promise<AccountLink> {
    const tokens = await this.d.tokenStore.load(TOKEN_REF);
    if (tokens) {
      try {
        await this.d.auth.revoke(tokens.refreshToken);
      } catch (err) {
        // best-effort. 로컬 정리는 계속 진행.
        this.d.logger.log('warn', 'auth.revoke.failed', { error: String(err) });
      }
    }
    await this.d.tokenStore.clear(TOKEN_REF);
    const cleared: AccountLink = {
      provider: null,
      subject: null,
      displayName: null,
      linkedAt: null,
      tokenRef: null,
      state: 'NONE',
    };
    await this.d.account.set(cleared);
    this.d.logger.metric('auth.unlink');
    return cleared;
  }

  /**
   * 만료 임박 시 토큰 갱신. 실패하면 EXPIRED 로 강등하고 false 를 반환한다(E-12-2).
   * 앱은 이 실패로 흐름을 차단하지 않는다(로컬 모드 유지).
   */
  async ensureFreshToken(): Promise<boolean> {
    const link = await this.d.account.get();
    if (link.state === 'NONE') return false;

    const tokens = await this.d.tokenStore.load(TOKEN_REF);
    if (!tokens) {
      await this.d.account.set({ ...link, state: 'EXPIRED' });
      return false;
    }
    if (tokens.accessTokenExpiresAt - this.d.clock.now() > REFRESH_SKEW_MS) {
      return true;
    }

    try {
      const refreshed = await this.d.auth.refresh(tokens.refreshToken);
      await this.d.tokenStore.save(TOKEN_REF, refreshed);
      if (link.state !== 'LINKED') await this.d.account.set({ ...link, state: 'LINKED' });
      return true;
    } catch (err) {
      this.d.logger.metric('auth.refresh.fail');
      this.d.logger.log('warn', 'auth.refresh.failed', { error: String(err) });
      await this.d.account.set({ ...link, state: 'EXPIRED' });
      return false;
    }
  }
}
