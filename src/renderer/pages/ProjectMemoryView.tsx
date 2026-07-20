/**
 * Project Memory View
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { ProjectMemoryViewModel } from '../store/ProjectMemoryViewModel';
import type { AppViewModel } from '../store/AppViewModel';

interface Props {
  app: AppViewModel;
}

const FIELDS: Array<{ key: keyof ProjectMemoryViewModel['draft']; label: string; rows?: number }> = [
  { key: 'title', label: 'ゲームタイトル' },
  { key: 'genre', label: 'ジャンル' },
  { key: 'worldSetting', label: '世界観', rows: 3 },
  { key: 'characters', label: 'キャラクター', rows: 3 },
  { key: 'rules', label: 'ルール', rows: 3 },
  { key: 'engines', label: '使用エンジン / 技術' },
  { key: 'languages', label: '使用言語' },
  { key: 'folderNotes', label: 'フォルダ構成', rows: 3 },
  { key: 'extra', label: 'その他', rows: 3 },
];

export function ProjectMemoryView({ app }: Props) {
  const vm = useViewModel(() => new ProjectMemoryViewModel(app));

  useEffect(() => {
    void vm.load();
  }, [vm, app.currentProject?.path]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Project Memory</h2>
          <p className="lead">プロジェクト文脈を AI が記憶し、チャットに自動反映します</p>
        </div>
        <button type="button" className="primary" disabled={vm.saving} onClick={() => void vm.save()}>
          {vm.saving ? '保存中…' : '保存'}
        </button>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      {!app.currentProject ? (
        <div className="panel empty-state">
          <p>先にプロジェクトを開いてください。</p>
        </div>
      ) : (
        <section className="panel stack glass-panel">
          <div className="meta">対象: {app.currentProject.path}</div>
          {FIELDS.map((f) => (
            <div key={f.key} className="field">
              <label>{f.label}</label>
              {f.rows ? (
                <textarea
                  rows={f.rows}
                  value={vm.draft[f.key]}
                  onChange={(e) => vm.updateField(f.key, e.target.value)}
                />
              ) : (
                <input
                  value={vm.draft[f.key]}
                  onChange={(e) => vm.updateField(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
