/**
 * ViewModel 基底ユーティリティ
 * React と薄い ViewModel クラスをつなぐ購読パターン。
 */
import { useEffect, useReducer, useRef } from 'react';

type Listener = () => void;

/** 変更通知可能な ViewModel 基底 */
export abstract class ViewModelBase {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 状態更新後に呼び、View を再描画させる */
  protected notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/**
 * ViewModel インスタンスを React コンポーネントにバインドするフック
 */
export function useViewModel<T extends ViewModelBase>(factory: () => T): T {
  const ref = useRef<T | null>(null);
  if (!ref.current) {
    ref.current = factory();
  }
  const vm = ref.current;
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => vm.subscribe(bump), [vm]);

  return vm;
}
