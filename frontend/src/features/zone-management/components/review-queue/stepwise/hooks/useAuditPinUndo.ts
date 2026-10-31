import { useCallback, useEffect, useRef, useState } from 'react';

export interface AuditPinUndo {
  canUndo: boolean;
  pushUndo: (restore: () => void) => void;
  undo: () => void;
}

/** Ngăn xếp hoàn tác cho thao tác ghim trong phiên sửa, kèm Ctrl+Z khi không gõ trong ô nhập. */
export function useAuditPinUndo(isEditMode: boolean): AuditPinUndo {
  const stackRef = useRef<Array<() => void>>([]);
  const [depth, setDepth] = useState(0);

  const pushUndo = useCallback((restore: () => void) => {
    stackRef.current.push(restore);
    setDepth(stackRef.current.length);
  }, []);

  const undo = useCallback(() => {
    const restore = stackRef.current.pop();
    setDepth(stackRef.current.length);
    restore?.();
  }, []);

  useEffect(() => {
    if (isEditMode) return;
    stackRef.current = [];
    setDepth(0);
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
      if (stackRef.current.length === 0) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, undo]);

  return { canUndo: depth > 0, pushUndo, undo };
}
