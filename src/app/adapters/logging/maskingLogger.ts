/**
 * 마스킹 구조적 로거 (Logger 포트 구현).
 * 설계 근거: document/architect/nfr.md 5.1 ("마스킹 필수: title/memo, 토큰/키, 이메일, 검색어 원문 →
 *           로그 금지. 길이/개수/해시 프리픽스만"), logic.md v1.1 §16.5 (MaskingLogger), V-15.
 *
 * 순수 로직(마스킹 규칙)만 담고, 실제 출력은 sink 로 주입받는다 → node:test 로 규칙 검증.
 */
import type { Logger, LogLevel } from '../../../core/ports/gateways.ts';

/** 값을 그대로 남기면 안 되는 필드 키(부분 일치, 소문자 비교). */
const SENSITIVE_KEYS = [
  'title',
  'memo',
  'note',
  'notes',
  'query',
  'q',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'password',
  'secret',
  'key',
  'email',
  'displayname',
  'subject',
];

export interface LogRecord {
  ts: number;
  level: LogLevel;
  category: string;
  event: string;
  fields?: Record<string, unknown>;
}

export type LogSink = (record: LogRecord) => void;

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k === s || k.includes(s));
}

/** 문자열 → "len:12 h:1a2b" 형태 요약(원문 비노출). */
export function maskValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return `len:${value.length} h:${hash.toString(16).slice(0, 4)}`;
  }
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value && typeof value === 'object') return 'object';
  return value;
}

export function maskFields(
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = isSensitiveKey(key) ? maskValue(value) : value;
  }
  return out;
}

export interface MaskingLoggerOptions {
  /** 이 레벨 미만은 버린다. 릴리스 기본 'warn'(nfr 5.1). */
  minLevel?: LogLevel;
  category?: string;
  now?: () => number;
}

export class MaskingLogger implements Logger {
  private readonly sink: LogSink;
  private readonly minWeight: number;
  private readonly category: string;
  private readonly now: () => number;
  readonly metrics: Array<{ name: string; value: number }> = [];

  constructor(sink: LogSink, options: MaskingLoggerOptions = {}) {
    this.sink = sink;
    this.minWeight = LEVEL_WEIGHT[options.minLevel ?? 'warn'];
    this.category = options.category ?? 'app';
    this.now = options.now ?? (() => Date.now());
  }

  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < this.minWeight) return;
    this.sink({
      ts: this.now(),
      level,
      category: this.category,
      event,
      fields: maskFields(fields),
    });
  }

  metric(name: string, value = 1): void {
    this.metrics.push({ name, value });
  }

  metricTotal(name: string): number {
    return this.metrics.filter((m) => m.name === name).reduce((sum, m) => sum + m.value, 0);
  }
}
