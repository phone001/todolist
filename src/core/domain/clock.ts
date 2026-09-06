/**
 * 시각 포트. 서비스는 Date.now() 를 직접 부르지 않고 Clock 에 의존한다(테스트 결정성).
 * 설계 근거: document/architect/overview.md "주요 기술 결정" 2, document/architect/logic.md 0.1.
 */
export interface Clock {
  /** 현재 시각 (epoch ms). */
  now(): number;
  /** 현재 IANA 타임존 문자열 (예: 'Asia/Seoul'). */
  timeZone(): string;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  timeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }
}

/** 테스트용 고정 시계. `set()` 으로 현재 시각을, 생성자로 타임존을 제어한다. */
export class FixedClock implements Clock {
  private current: number;
  private zone: string;

  constructor(currentMs: number, timeZone = 'UTC') {
    this.current = currentMs;
    this.zone = timeZone;
  }

  now(): number {
    return this.current;
  }

  timeZone(): string {
    return this.zone;
  }

  set(currentMs: number): void {
    this.current = currentMs;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
