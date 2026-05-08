'use client';

import { useState } from 'react';
import {
  type ColId,
  DEFAULT_VISIBILITY,
  LEADS_COL_VISIBILITY_KEY,
} from '@/constants/lead-columns';

export function useColumnVisibility(storageKey?: string) {
  const key = storageKey ?? LEADS_COL_VISIBILITY_KEY;
  const [visible, setVisible] = useState<Record<ColId, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBILITY;
    try {
      const stored = localStorage.getItem(key);
      return stored ? { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) } : DEFAULT_VISIBILITY;
    } catch {
      return DEFAULT_VISIBILITY;
    }
  });

  function toggle(id: ColId) {
    setVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  function resetToDefaults() {
    try { localStorage.removeItem(key); } catch { /* noop */ }
    setVisible(DEFAULT_VISIBILITY);
  }

  return { visible, toggle, resetToDefaults };
}
