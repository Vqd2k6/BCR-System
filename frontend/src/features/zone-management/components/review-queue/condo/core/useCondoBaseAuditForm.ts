import { useState, useEffect, useCallback, useRef } from 'react';
import type { AuditStepwiseData, DiffItem } from '../../stepwise/types';

interface UseCondoBaseAuditFormOptions<TFormState extends Record<string, unknown>> {
  data: AuditStepwiseData;
  stepIds: string[];
  normalizeData: (data: AuditStepwiseData) => TFormState;
  recomputeDerivedOnChange?: (nextState: TFormState, changedKey: string) => TFormState;
  buildUpdatesPayload?: (
    formState: TFormState,
    dirtyFields: Record<string, { label: string; oldValue: unknown; newValue: unknown }>
  ) => Record<string, unknown>;
  onDirtyChange?: (dirtyData: {
    dirtyCount: number;
    diffItems: DiffItem[];
    updates: Record<string, unknown>;
    discardAll: (silent?: boolean) => void;
    discardDiffItem?: (fieldKey: string) => void;
  }) => void;
}

export function useCondoBaseAuditForm<TFormState extends Record<string, unknown>>({
  data,
  stepIds,
  normalizeData,
  recomputeDerivedOnChange,
  buildUpdatesPayload,
  onDirtyChange,
}: UseCondoBaseAuditFormOptions<TFormState>) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string>(stepIds[0] || 'step-1');
  const [initialState, setInitialState] = useState<TFormState>(() => normalizeData(data));
  const [formState, setFormState] = useState<TFormState>(() => normalizeData(data));
  const [dirtyFields, setDirtyFields] = useState<
    Record<string, { label: string; oldValue: unknown; newValue: unknown }>
  >({});

  const initialStateRef = useRef<TFormState>(initialState);
  initialStateRef.current = initialState;

  // Đồng bộ lại dữ liệu khi tải mới từ server
  useEffect(() => {
    const normalized = normalizeData(data);
    setInitialState(normalized);
    setFormState(normalized);
    setDirtyFields({});
  }, [data, normalizeData]);

  const programmaticScrollLockUntilRef = useRef<number>(0);

  // Scrollspy theo dõi bước đang hiển thị trong #audit-studio-scroll-container
  useEffect(() => {
    const scrollContainer = document.getElementById('audit-studio-scroll-container');
    if (!scrollContainer || stepIds.length === 0) return;

    const handleScroll = () => {
      if (Date.now() < programmaticScrollLockUntilRef.current) {
        return;
      }
      const containerRect = scrollContainer.getBoundingClientRect();
      let currentActive = stepIds[0];
      for (const sid of stepIds) {
        const el = document.getElementById(sid);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top - containerRect.top <= 160) {
            currentActive = sid;
          }
        }
      }
      setActiveStepId(currentActive);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [stepIds]);

  const scrollToStep = useCallback((stepId: string) => {
    programmaticScrollLockUntilRef.current = Date.now() + 900;
    setActiveStepId(stepId);
    const container = document.getElementById('audit-studio-scroll-container');
    const el = document.getElementById(stepId);
    if (container && el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetTop = Math.max(0, elRect.top - containerRect.top + container.scrollTop - 16);
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    } else if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleFieldChange = useCallback(
    (key: keyof TFormState & string, label: string, val: unknown) => {
      setFormState((prev) => {
        let next = { ...prev, [key]: val };
        if (recomputeDerivedOnChange) {
          next = recomputeDerivedOnChange(next, key);
        }
        return next;
      });

      setDirtyFields((prev) => {
        const origVal = initialStateRef.current[key];
        const isSame = JSON.stringify(origVal) === JSON.stringify(val);
        const nextDirty = { ...prev };
        if (isSame) {
          delete nextDirty[key];
        } else {
          nextDirty[key] = {
            label,
            oldValue: origVal,
            newValue: val,
          };
        }
        return nextDirty;
      });
    },
    [recomputeDerivedOnChange]
  );

  const handleNestedFieldChange = useCallback(
    (
      parentKey: keyof TFormState & string,
      childKey: string,
      label: string,
      val: unknown
    ) => {
      const compositeKey = `${parentKey}.${childKey}`;
      setFormState((prev) => {
        const curParent =
          prev[parentKey] && typeof prev[parentKey] === 'object'
            ? { ...(prev[parentKey] as Record<string, unknown>) }
            : {};
        curParent[childKey] = val;
        let next = { ...prev, [parentKey]: curParent } as TFormState;
        if (recomputeDerivedOnChange) {
          next = recomputeDerivedOnChange(next, compositeKey);
        }
        return next;
      });

      setDirtyFields((prev) => {
        const origParent =
          initialStateRef.current[parentKey] &&
          typeof initialStateRef.current[parentKey] === 'object'
            ? (initialStateRef.current[parentKey] as Record<string, unknown>)
            : {};
        const origVal = origParent[childKey];
        const isSame = JSON.stringify(origVal) === JSON.stringify(val);
        const nextDirty = { ...prev };
        if (isSame) {
          delete nextDirty[compositeKey];
        } else {
          nextDirty[compositeKey] = {
            label,
            oldValue: origVal,
            newValue: val,
          };
        }
        return nextDirty;
      });
    },
    [recomputeDerivedOnChange]
  );

  const isFieldDirty = useCallback(
    (fieldKey: string, subKey?: string): boolean => {
      if (subKey) {
        return Boolean(dirtyFields[`${fieldKey}.${subKey}`]);
      }
      if (dirtyFields[fieldKey]) return true;
      const prefix = `${fieldKey}.`;
      return Object.keys(dirtyFields).some((k) => k.startsWith(prefix));
    },
    [dirtyFields]
  );

  const discardField = useCallback((fieldKey: string) => {
    setDirtyFields((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });

    setFormState((prev) => {
      if (fieldKey.includes('.')) {
        const [parentKey, childKey] = fieldKey.split('.');
        const origParent =
          initialStateRef.current[parentKey] &&
          typeof initialStateRef.current[parentKey] === 'object'
            ? (initialStateRef.current[parentKey] as Record<string, unknown>)
            : {};
        const curParent =
          prev[parentKey] && typeof prev[parentKey] === 'object'
            ? { ...(prev[parentKey] as Record<string, unknown>) }
            : {};
        curParent[childKey] = origParent[childKey];
        let next = { ...prev, [parentKey]: curParent } as TFormState;
        if (recomputeDerivedOnChange) {
          next = recomputeDerivedOnChange(next, fieldKey);
        }
        return next;
      }

      let next = {
        ...prev,
        [fieldKey]: initialStateRef.current[fieldKey],
      } as TFormState;
      if (recomputeDerivedOnChange) {
        next = recomputeDerivedOnChange(next, fieldKey);
      }
      return next;
    });
  }, [recomputeDerivedOnChange]);

  const discardAll = useCallback(
    (silent?: boolean) => {
      if (!silent && Object.keys(dirtyFields).length > 0) {
        if (!window.confirm('Bạn có chắc chắn muốn hoàn tác toàn bộ thay đổi chưa lưu?')) {
          return;
        }
      }
      setFormState(initialStateRef.current);
      setDirtyFields({});
      setIsEditMode(false);
    },
    [dirtyFields]
  );

  const computeDiffPayloadAndUpdates = useCallback(() => {
    const diffItems: DiffItem[] = Object.entries(dirtyFields).map(([field, info]) => ({
      field,
      label: info.label,
      oldValue: info.oldValue,
      newValue: info.newValue,
    }));

    let updates: Record<string, unknown> = {};
    if (buildUpdatesPayload) {
      updates = buildUpdatesPayload(formState, dirtyFields);
    } else {
      for (const [key] of Object.entries(dirtyFields)) {
        if (key.includes('.')) {
          const [parentKey] = key.split('.');
          updates[parentKey] = formState[parentKey];
        } else {
          updates[key] = formState[key];
        }
      }
    }

    return { diffItems, updates };
  }, [dirtyFields, formState, buildUpdatesPayload]);

  // Đồng bộ trạng thái dirty lên AuditStudioModal
  useEffect(() => {
    if (!onDirtyChange) return;
    const { diffItems, updates } = computeDiffPayloadAndUpdates();
    onDirtyChange({
      dirtyCount: diffItems.length,
      diffItems,
      updates,
      discardAll,
      discardDiffItem: discardField,
    });
  }, [dirtyFields, formState, computeDiffPayloadAndUpdates, discardAll, discardField, onDirtyChange]);

  return {
    isEditMode,
    setIsEditMode,
    activeStepId,
    scrollToStep,
    initialState,
    formState,
    dirtyFields,
    dirtyCount: Object.keys(dirtyFields).length,
    handleFieldChange,
    handleNestedFieldChange,
    isFieldDirty,
    discardField,
    discardAll,
    computeDiffPayloadAndUpdates,
  };
}

