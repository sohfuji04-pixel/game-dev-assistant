/**
 * サイドバーナビゲーション（View）
 */
import type { AppPage, AppViewModel } from '../store/AppViewModel';

type NavItem = { kind: 'page'; id: AppPage; label: string; hint?: string };

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'メイン',
    items: [
      { kind: 'page', id: 'dashboard', label: 'ダッシュボード', hint: '1' },
      { kind: 'page', id: 'hub', label: '創作ツール', hint: '2' },
    ],
  },
  {
    label: 'AI / 3D',
    items: [
      { kind: 'page', id: 'chatgpt', label: 'ChatGPT', hint: '3' },
      { kind: 'page', id: 'ui-create-ai', label: 'UI 作成 AI' },
      { kind: 'page', id: 'blender', label: 'Blender AI' },
      { kind: 'page', id: 'unity', label: 'Unity AI' },
      { kind: 'page', id: 'prompt-builder', label: 'Prompt Builder' },
      { kind: 'page', id: 'image-ai', label: 'Image AI' },
      { kind: 'page', id: 'vision-ai', label: 'Vision AI' },
    ],
  },
  {
    label: '開発',
    items: [
      { kind: 'page', id: 'cursor', label: 'Cursor 連携', hint: '5' },
      { kind: 'page', id: 'git', label: 'Git', hint: '6' },
      { kind: 'page', id: 'assets', label: 'Assets', hint: '7' },
      { kind: 'page', id: 'memory', label: 'Project Memory' },
    ],
  },
  {
    label: '設定',
    items: [
      { kind: 'page', id: 'logs', label: 'ログ', hint: '8' },
      { kind: 'page', id: 'settings', label: '設定', hint: '9' },
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
        <p>ゲーム開発専用 AI 統合環境</p>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="nav-group">
          <div className="nav-group-label">{group.label}</div>
          {group.items.map((item) => {
            const active = vm.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-btn${active ? ' active' : ''}`}
                onClick={() => {
                  if (item.id === 'hub') {
                    vm.openHubOverview();
                    return;
                  }
                  vm.setPage(item.id);
                }}
                title={item.hint ? `Ctrl+${item.hint}` : undefined}
              >
                <span>{item.label}</span>
                {item.hint && <kbd className="nav-kbd">{item.hint}</kbd>}
              </button>
            );
          })}
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
