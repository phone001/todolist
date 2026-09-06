/**
 * 제목/메모/유형명 검색. 2자 이상 FTS, 2자 미만 LIKE 폴백(결과 상한).
 * 설계 근거: document/architect/logic.md 8. F-11, 정책 P-11/P-12. AC-13, AC-14, V-9, V-11.
 */
import { LIKE_FALLBACK_LIMIT, resolveSearchMode } from '../domain/search.ts';
import type { Schedule, ScheduleFilter } from '../domain/types.ts';
import type { ScheduleRepository } from '../ports/repositories.ts';

export interface SearchParams {
  query: string;
  filter?: ScheduleFilter;
  limit?: number;
}

export interface SearchResult {
  items: Schedule[];
  /** 결과가 상한으로 잘렸거나 LIKE 폴백이라 제한적임(P-11). */
  limited: boolean;
  mode: 'empty' | 'fts' | 'like';
}

export class SearchService {
  private readonly schedules: ScheduleRepository;

  constructor(schedules: ScheduleRepository) {
    this.schedules = schedules;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const mode = resolveSearchMode(params.query);
    if (mode === 'empty') {
      return { items: [], limited: false, mode };
    }

    const limit = mode === 'like' ? LIKE_FALLBACK_LIMIT : params.limit ?? 50;
    const res = await this.schedules.search({
      query: params.query.trim(),
      mode,
      filter: params.filter,
      limit,
    });

    return {
      items: res.items,
      limited: res.limited || mode === 'like',
      mode,
    };
  }
}
