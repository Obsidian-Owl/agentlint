import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { EpicAutoModeState } from '../components/ResumePrompt';

export interface EpicAutoModeFile {
  epicId: string;
  epicTitle: string;
  lastTask: string;
  lastTaskTitle: string;
  completedTasks: number;
  totalTasks: number;
  featureDir: string;
}

export function getEpicAutoModePath(projectPath: string): string {
  return join(projectPath, '.agent', 'epic-auto-mode');
}

export function detectInterruptedEpic(projectPath: string): EpicAutoModeState | null {
  const filePath = getEpicAutoModePath(projectPath);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as EpicAutoModeFile;

    return {
      epicId: data.epicId,
      epicTitle: data.epicTitle,
      lastTask: data.lastTask,
      lastTaskTitle: data.lastTaskTitle,
      completedTasks: data.completedTasks,
      totalTasks: data.totalTasks,
      featureDir: data.featureDir,
    };
  } catch {
    return null;
  }
}

export function clearEpicAutoMode(projectPath: string): void {
  const filePath = getEpicAutoModePath(projectPath);

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}
