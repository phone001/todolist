/**
 * react-native-keychain 기반 TokenStore 어댑터 (네이티브 바인딩).
 * 설계 근거: document/architect/logic.md 13.2/13.4 ("Keychain kSecAttrAccessibleWhenUnlockedThisDeviceOnly",
 *           토큰은 DB 가 아닌 OS 보안 저장소에만), v1.1 §16.5, V-14/V-24.
 * 환경 제약: 라이브러리 의존 → 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 *
 * 토큰 값은 이 저장소에만 존재한다. DB(account_link.token_ref)에는 참조 문자열만 저장된다.
 */
import * as Keychain from 'react-native-keychain';
import type { TokenSet, TokenStore } from '../../../core/ports/gateways.ts';

const ACCESSIBLE = Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

export class KeychainTokenStore implements TokenStore {
  async save(ref: string, tokens: TokenSet): Promise<void> {
    await Keychain.setGenericPassword(ref, JSON.stringify(tokens), {
      service: ref,
      accessible: ACCESSIBLE,
    });
  }

  async load(ref: string): Promise<TokenSet | null> {
    const creds = await Keychain.getGenericPassword({ service: ref });
    if (!creds) return null;
    try {
      return JSON.parse(creds.password) as TokenSet;
    } catch {
      return null;
    }
  }

  async clear(ref: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: ref });
  }
}

/**
 * SQLCipher 키(D-03) 보관/생성. 최초 실행 시 CSPRNG 32바이트 생성 → Keychain 저장(logic 13.4).
 * 반환값을 OpSqliteDb.openDatabase({ encryptionKey }) 에 넘긴다.
 */
export async function loadOrCreateDbKey(service = 'db.key'): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service });
  if (existing) return existing.password;
  const bytes = new Uint8Array(32);
  // RN 환경: global.crypto.getRandomValues (Hermes/폴리필). 없으면 예외 → 상위에서 안전 모드.
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  const key = Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
  await Keychain.setGenericPassword(service, key, { service, accessible: ACCESSIBLE });
  return key;
}
