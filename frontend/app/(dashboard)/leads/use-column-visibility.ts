'use client';

import { useState } from 'react';
import {
  type ColId,
  DEFAULT_VISIBILITY,
  LEADS_COL_VISIBILITY_KEY,
} from '@/constants/lead-columns';

export function useColumnVisibility() {
  const [visible, setVisible] = useState<Record<ColId, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBILITY;
    try {
      const stored = localStorage.getItem(LEADS_COL_VISIBILITY_KEY);
      return stored ? { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) } : DEFAULT_VISIBILITY;
    } catch {
      return DEFAULT_VISIBILITY;
    }
  });

  function toggle(id: ColId) {
    setVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(LEADS_COL_VISIBILITY_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  function resetToDefaults() {
    try { localStorage.removeItem(LEADS_COL_VISIBILITY_KEY); } catch { /* noop */ }
    setVisible(DEFAULT_VISIBILITY);
  }

  return { visible, toggle, resetToDefaults };
}
