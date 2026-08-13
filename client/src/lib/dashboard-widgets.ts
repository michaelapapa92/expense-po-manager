import { useState, useCallback, useEffect } from "react";

export interface WidgetConfig {
  id: string;
  label: string;
  description: string;
  visible: boolean;
  order: number;
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "summary-cards", label: "Summary Cards", description: "Pending, Reimbursed, and Attention totals", visible: true, order: 0 },
  { id: "needs-attention", label: "Needs Attention", description: "Items requiring your action", visible: true, order: 1 },
  { id: "spending-analytics", label: "Spending Analytics", description: "Category breakdown and monthly spending charts", visible: true, order: 2 },
  { id: "recent-activity", label: "Recent Activity", description: "Your most recent expense submissions", visible: true, order: 3 },
];

const STORAGE_KEY = "aseva-dashboard-widgets";

function loadWidgets(): WidgetConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WIDGETS;
    const parsed: WidgetConfig[] = JSON.parse(stored);
    const existingIds = new Set(parsed.map(w => w.id));
    const merged = [...parsed];
    for (const def of DEFAULT_WIDGETS) {
      if (!existingIds.has(def.id)) {
        merged.push({ ...def, order: merged.length });
      }
    }
    return merged
      .filter(w => DEFAULT_WIDGETS.some(d => d.id === w.id))
      .sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveWidgets(widgets: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets);

  const updateWidgets = useCallback((newWidgets: WidgetConfig[]) => {
    const ordered = newWidgets.map((w, i) => ({ ...w, order: i }));
    setWidgets(ordered);
    saveWidgets(ordered);
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      saveWidgets(updated);
      return updated;
    });
  }, []);

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reordered = updated.map((w, i) => ({ ...w, order: i }));
      saveWidgets(reordered);
      return reordered;
    });
  }, []);

  const resetWidgets = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    saveWidgets(DEFAULT_WIDGETS);
  }, []);

  const isVisible = useCallback((id: string) => {
    return widgets.find(w => w.id === id)?.visible ?? true;
  }, [widgets]);

  return { widgets, updateWidgets, toggleWidget, moveWidget, resetWidgets, isVisible };
}
