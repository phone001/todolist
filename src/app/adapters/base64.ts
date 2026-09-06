/**
 * base64url 인코딩 유틸 (순수 함수, 런타임 비의존).
 * Node(테스트)·Hermes(RN) 모두에서 동작하도록 전역을 느슨하게 참조한다.
 * 설계 근거: cursor.ts / auth/tokens.ts 공통.
 */
type MaybeBuffer = {
  from(input: string, enc: string): { toString(enc: string): string };
};

const g = globalThis as Record<string, unknown>;

function getBuffer(): MaybeBuffer | null {
  const b = g.Buffer;
  return typeof b === 'function' ? (b as unknown as MaybeBuffer) : null;
}

export function utf8ToBase64Url(s: string): string {
  const Buf = getBuffer();
  let b64: string;
  if (Buf) {
    b64 = Buf.from(s, 'utf8').toString('base64');
  } else {
    const btoaFn = g.btoa as ((v: string) => string) | undefined;
    b64 = btoaFn ? btoaFn(unescape(encodeURIComponent(s))) : s;
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToUtf8(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const Buf = getBuffer();
  if (Buf) return Buf.from(b64, 'base64').toString('utf8');
  const atobFn = g.atob as ((v: string) => string) | undefined;
  return atobFn ? decodeURIComponent(escape(atobFn(b64))) : b64;
}
