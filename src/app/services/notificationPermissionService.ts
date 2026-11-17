import type { PermissionStatus } from '../../core/ports/gateways.ts';

/** OS 조회와 요청은 로컬·원격 알림이 공유하는 게이트웨이를 사용한다. */
export interface NotificationPermissionGateway {
  getPermission(): PermissionStatus;
  refreshPermission(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
}

export class NotificationPermissionService {
  private readonly gateway: NotificationPermissionGateway;
  private readonly syncReminders: () => Promise<unknown>;
  private readonly registerRemotePush: () => Promise<unknown>;

  constructor(
    gateway: NotificationPermissionGateway,
    syncReminders: () => Promise<unknown>,
    registerRemotePush: () => Promise<unknown>,
  ) {
    this.gateway = gateway;
    this.syncReminders = syncReminders;
    this.registerRemotePush = registerRemotePush;
  }

  getPermission(): PermissionStatus {
    return this.gateway.getPermission();
  }

  async refresh(): Promise<PermissionStatus> {
    const previous = this.getPermission();
    const status = await this.gateway.refreshPermission();
    // 기기 설정에서 허용하고 복귀해도 등록·예약을 즉시 재시도한다.
    if (previous !== 'granted' && status === 'granted') void this.synchronize();
    return status;
  }

  async request(): Promise<PermissionStatus> {
    let status = await this.refresh();
    // 이미 거부한 사용자에게 OS 팝업을 반복 요청하지 않는다.
    if (status === 'undetermined') {
      status = await this.gateway.requestPermission();
      if (status === 'granted') void this.synchronize();
    }
    return status;
  }

  private async synchronize(): Promise<void> {
    await Promise.allSettled([
      Promise.resolve().then(this.syncReminders),
      Promise.resolve().then(this.registerRemotePush),
    ]);
  }
}
