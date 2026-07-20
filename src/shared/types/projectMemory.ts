/**
 * Project Memory（プロジェクト記憶）共有型
 */
export interface ProjectMemory {
  id: string;
  projectPath: string;
  title: string;
  genre: string;
  worldSetting: string;
  characters: string;
  rules: string;
  engines: string;
  languages: string;
  folderNotes: string;
  extra: string;
  updatedAt: string;
}

export const EMPTY_PROJECT_MEMORY: Omit<ProjectMemory, 'id' | 'projectPath' | 'updatedAt'> = {
  title: '',
  genre: '',
  worldSetting: '',
  characters: '',
  rules: '',
  engines: '',
  languages: '',
  folderNotes: '',
  extra: '',
};
