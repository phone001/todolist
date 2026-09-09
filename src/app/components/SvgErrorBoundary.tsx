/**
 * SVG 서브트리 렌더 예외 포획 → onFail() 호출 (크래시 차단).
 * 설계 근거: document/architect/logic.md v1.7 §16.9.5 (3단계 폴백 체인), nfr.md v1.5 §13.4, E-17-2, AC-34.
 * 환경 제약: react 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React from 'react';

interface Props {
  /** SVG 렌더가 예외를 던지면 호출된다. 상위는 이 신호로 renderFailed=true 전환. */
  onFail: () => void;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

export class SvgErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(): void {
    // 예외를 상위로 전파하지 않는다. 폴백 전환만 알린다 (AC-34 무크래시).
    this.props.onFail();
  }

  componentDidUpdate(prev: Props): void {
    // children 이 교체되면(폴백 경로로 전환) 경계를 리셋해 새 서브트리를 시도할 수 있게 한다.
    if (prev.children !== this.props.children && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
