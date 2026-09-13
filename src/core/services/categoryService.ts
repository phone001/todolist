/**
 * 카테고리(유형) 관리.
 * 설계 근거: document/architect/logic.md 5. F-06, 예외 E-06-1/E-06-2. V-17.
 * 5.1: 색상 자동 배정(P-59, E-06-7, AC-77) — v1.15.
 */
import { AppError, ErrorCodes } from '../domain/errors.ts';
import { assignCategoryColor, CATEGORY_COLOR_FALLBACK } from '../domain/categoryColor.ts';
import type { Clock } from '../domain/clock.ts';
import type { Category } from '../domain/types.ts';
import type { CategoryRepository, ScheduleRepository, UnitOfWork } from '../ports/repositories.ts';

export interface CategoryServiceDeps {
  clock: Clock;
  uow: UnitOfWork;
  categories: CategoryRepository;
  schedules: ScheduleRepository;
}

export class CategoryService {
  private readonly d: CategoryServiceDeps;

  constructor(deps: CategoryServiceDeps) {
    this.d = deps;
  }

  list(): Promise<Category[]> {
    return this.d.categories.list();
  }

  /**
   * `color` 가 명시적으로 전달되면 그대로 사용(후방 호환 — 데모/테스트 픽스처).
   * 생략되면 기존 유형 색상 목록으로 `assignCategoryColor` 를 호출해 자동 배정한다(P-59).
   * `list()` 조회는 색상 배정에만 필요한 경우에 한해 1회만 수행한다(중복 쿼리 없음).
   */
  async create(name: string, color?: string, icon: string | null = null): Promise<Category> {
    const now = this.d.clock.now();
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 30) {
      throw new AppError(ErrorCodes.VALIDATION_TITLE_REQUIRED, '유형 이름은 1~30자여야 합니다.', 'name');
    }

    let assignedColor = color;
    if (assignedColor === undefined) {
      const existing = await this.d.categories.list();
      try {
        assignedColor = assignCategoryColor(existing.map((c) => c.color));
      } catch {
        // E-06-7: 색상 배정 로직 실패 시에도 유형 생성 자체는 막지 않는다.
        assignedColor = CATEGORY_COLOR_FALLBACK;
      }
    }

    return this.d.categories.insert({
      name: trimmed,
      color: assignedColor,
      icon,
      isSystem: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async rename(id: number, name: string): Promise<Category> {
    return this.d.categories.rename(id, name.trim(), this.d.clock.now());
  }

  /**
   * E-06-2. 시스템 기본 유형은 삭제 불가. 사용 중이면 소속 일정을 "기타"로 재지정 후 삭제.
   * 재지정과 삭제는 한 트랜잭션 — 삭제가 실패하면 재지정도 롤백된다.
   */
  async remove(id: number): Promise<{ reassigned: number }> {
    const category = await this.d.categories.findById(id);
    if (!category) {
      throw new AppError(ErrorCodes.NOT_FOUND_CATEGORY, '유형을 찾을 수 없습니다.');
    }
    if (category.isSystem) {
      throw new AppError(ErrorCodes.POLICY_SYSTEM_CATEGORY_DELETE, '기본 유형은 삭제할 수 없습니다.');
    }
    const fallbackId = await this.d.categories.systemDefaultId();

    return this.d.uow.transaction(async () => {
      const reassigned = await this.d.schedules.reassignCategory(id, fallbackId);
      await this.d.categories.remove(id);
      return { reassigned };
    });
  }
}
