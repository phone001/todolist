/**
 * 카테고리(유형) 관리.
 * 설계 근거: document/architect/logic.md 5. F-06, 예외 E-06-1/E-06-2. V-17.
 */
import { AppError, ErrorCodes } from '../domain/errors.ts';
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

  async create(name: string, color = '#8E8E93', icon: string | null = null): Promise<Category> {
    const now = this.d.clock.now();
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 30) {
      throw new AppError(ErrorCodes.VALIDATION_TITLE_REQUIRED, '유형 이름은 1~30자여야 합니다.', 'name');
    }
    return this.d.categories.insert({
      name: trimmed,
      color,
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
