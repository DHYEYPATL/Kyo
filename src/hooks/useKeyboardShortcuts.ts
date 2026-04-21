'use client';

import { useEffect } from 'react';

interface ShortcutMap {
  onToggleMic: () => void;
  onManualRefresh: () => void;
  onClickSuggestion1: () => void;
  onClickSuggestion2: () => void;
  onClickSuggestion3: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

/**
 * useKeyboardShortcuts (#15)
 *
 * Global shortcuts:
 *   Space        → toggle mic (when not in an input)
 *   R            → manual refresh
 *   1 / 2 / 3   → click suggestion 1/2/3 from latest batch
 *   Cmd/Ctrl + E → export session
 *   Cmd/Ctrl + , → open settings
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in an input/textarea/select
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isContentEditable = target.isContentEditable;

      if (isInput || isContentEditable) return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === 'e') {
        e.preventDefault();
        shortcuts.onExport();
        return;
      }
      if (meta && e.key === ',') {
        e.preventDefault();
        shortcuts.onOpenSettings();
        return;
      }

      // Non-meta shortcuts
      if (meta) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          shortcuts.onToggleMic();
          break;
        case 'r':
        case 'R':
          shortcuts.onManualRefresh();
          break;
        case '1':
          shortcuts.onClickSuggestion1();
          break;
        case '2':
          shortcuts.onClickSuggestion2();
          break;
        case '3':
          shortcuts.onClickSuggestion3();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}
