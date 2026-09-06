/**
 * Zustand 스토어 — 서비스 호출 결과 스냅샷 + 무효화 플래그.
 * 설계 근거: document/architect/logic.md v1.1 §16.3 ("서비스는 상태 비보유 → 스토어에는 결과 스냅샷만").
 * 환경 제약: zustand 의존 → 파이프라인 미실행(정적 리뷰). 순수 무효화 로직은 bindings.ts 로 테스트.
 */
import { create } from 'zustand';
import type { Schedule } from '../../core/domain/types.ts';
import type { StoreSlice } from './bindings.ts';

interface DashboardSnap {
  total: number;
  done: number;
  notDone: number;
  completionRate: number;
  nextScheduleId: number | null;
  empty: boolean;
}

interface ShellState {
  dashboard: DashboardSnap | null;
  list: { items: Schedule[]; nextCursor: string | null };
  search: { query: string; items: Schedule[]; limited: boolean };
  stale: Record<StoreSlice, boolean>;

  setDashboard(s: DashboardSnap): void;
  setList(items: Schedule[], nextCursor: string | null, append: boolean): void;
  setSearch(query: string, items: Schedule[], limited: boolean): void;
  invalidate(...slices: StoreSlice[]): void;
  clearStale(slice: StoreSlice): void;
}

const NO_STALE: Record<StoreSlice, boolean> = {
  dashboard: false,
  list: false,
  search: false,
  categories: false,
  settings: false,
  account: false,
};

export const useShellStore = create<ShellState>((set) => ({
  dashboard: null,
  list: { items: [], nextCursor: null },
  search: { query: '', items: [], limited: false },
  stale: { ...NO_STALE },

  setDashboard: (s) => set({ dashboard: s }),
  setList: (items, nextCursor, append) =>
    set((st) => ({
      list: { items: append ? [...st.list.items, ...items] : items, nextCursor },
    })),
  setSearch: (query, items, limited) => set({ search: { query, items, limited } }),
  invalidate: (...slices) =>
    set((st) => {
      const next = { ...st.stale };
      for (const s of slices) next[s] = true;
      return { stale: next };
    }),
  clearStale: (slice) => set((st) => ({ stale: { ...st.stale, [slice]: false } })),
}));
