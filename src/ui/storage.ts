// 浏览器本地持久化（阶段 2：自动保存）。
import type { Project } from '../lib/types';

const KEY = 'storyboard-compiler:project:v1';

export function loadSavedProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Project>;
    if (!p || !Array.isArray(p.shots) || !Array.isArray(p.cards) || !Array.isArray(p.assets)) {
      return null;
    }
    return p as Project;
  } catch {
    return null;
  }
}

export function saveProject(p: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 配额不足等情况：忽略，不阻塞编辑
  }
}
