/**
 * サイドバーナビゲーション（View）
 * セクション分けで目的の画面へ素早く移動できるようにする。
 */
import type { AppPage, AppViewModel } from '../store/AppViewModel';

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ id: AppPage; label: string; hint?: string }>;
}> = [
  {
    label: 'メイン',
    items: [
      { id: 'dashboard', label: 'ダッシュボード', hint: '1' },
      { id: 'hub', label: '創作ツール', hint: '2' },
    ],
  },
  {
    label: '開発',
    items: [
      { id: 'blender', label: 'Blender AI', hint: '3' },
      { id: 'unity', label: 'Unity AI', hint: '4' },
      { id: 'cursor', label: 'Cursor 連携', hint: '5' },
      { id: 'git', label: 'Git', hint: '6' },
      { id: 'assets', label: 'Assets', hint: '7' },
    ],
  },
  {
    label: 'システム',
    items: [
      { id: 'logs', label: 'ログ', hint: '8' },
      { id: 'settings', label: '設定', hint: '9' },
    ],
  },
];

interface Props {
  vm: AppViewModel;
}

export function Sidebar({ vm }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>Game Dev Assistant</h1>
        <p>ゲーム開発支援ツール</p>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="nav-group">
          <div className="nav-group-label">{group.label}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn${vm.page === item.id ? ' active' : ''}`}
              onClick={() => vm.setPage(item.id)}
              title={item.hint ? `Ctrl+${item.hint}` : undefined}
            >
              <span>{item.label}</span>
              {item.hint && <kbd className="nav-kbd">{item.hint}</kbd>}
            </button>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {vm.currentProject && (
        <div className="sidebar-project" title={vm.currentProject.path}>
          <div className="meta">作業中</div>
          <div className="sidebar-project-name">{vm.currentProject.name}</div>
        </div>
      )}

      <div className="meta" style={{ padding: '0.5rem', fontSize: '0.75rem' }}>
        v{vm.version || '—'}
      </div>
    </aside>
  );
}
