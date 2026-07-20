/**
 * アプリケーションルート（View 層の組み立て）
 */
import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { CreatorHubView } from './pages/CreatorHubView';
import { CursorView } from './pages/CursorView';
import { GitView } from './pages/GitView';
import { AssetsView } from './pages/AssetsView';
import { SettingsView } from './pages/SettingsView';
import { LogsView } from './pages/LogsView';
import { getAppViewModel, type AppPage } from './store/AppViewModel';
import { useViewModel } from './store/ViewModelBase';
import { ApiClient } from './services/ApiClient';

const PAGE_HOTKEYS: Record<string, AppPage> = {
  '1': 'dashboard',
  '2': 'hub',
  '3': 'cursor',
  '4': 'git',
  '5': 'assets',
  '6': 'logs',
  '7': 'settings',
};

export default function App() {
  const app = useViewModel(() => getAppViewModel());

  useEffect(() => {
    void app.init();
    return () => app.dispose();
  }, [app]);

  useEffect(() => {
    const theme = app.settings?.theme ?? 'dark';
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [app.settings?.theme]);

  // Ctrl+1〜7 で画面切替
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const page = PAGE_HOTKEYS[e.key];
      if (!page) return;
      e.preventDefault();
      app.setPage(page);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  const truncatePath = (p: string, max = 56) =>
    p.length <= max ? p : `…${p.slice(p.length - max + 1)}`;

  return (
    <div className="app-shell">
      <Sidebar vm={app} />
      <div className="content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="project">
              {app.currentProject ? (
                <>
                  <strong>{app.currentProject.name}</strong>
                  <span className="meta truncate" title={app.currentProject.path}>
                    {truncatePath(app.currentProject.path)}
                  </span>
                </>
              ) : (
                <span className="meta">プロジェクト未選択</span>
              )}
            </div>
          </div>
          <div className="row topbar-actions">
            {app.updaterStatus.status !== 'idle' && app.updaterStatus.status !== 'not-available' && (
              <span className="chip">{app.updaterStatus.message ?? app.updaterStatus.status}</span>
            )}
            {app.currentProject && (
              <>
                <button type="button" onClick={() => app.setPage('hub')}>
                  創作ツール
                </button>
                <button
                  type="button"
                  onClick={() => void ApiClient.launchCursor(app.currentProject!.path)}
                >
                  Cursor
                </button>
                <button
                  type="button"
                  onClick={() => void ApiClient.revealInFolder(app.currentProject!.path)}
                >
                  エクスプローラー
                </button>
              </>
            )}
            <button type="button" className="primary" onClick={() => void app.openProject()}>
              開く
            </button>
          </div>
        </header>

        {app.updaterStatus.status === 'available' && (
          <div className="banner warn">
            新しいバージョンがあります
            {app.updaterStatus.version ? `（v${app.updaterStatus.version}）` : ''}
            <span className="row" style={{ marginTop: '0.5rem' }}>
              <button type="button" className="primary" onClick={() => void ApiClient.downloadUpdate()}>
                ダウンロード
              </button>
              <button type="button" onClick={() => app.setPage('settings')}>
                設定へ
              </button>
            </span>
          </div>
        )}
        {app.updaterStatus.status === 'downloaded' && (
          <div className="banner warn">
            {app.updaterStatus.message ?? 'ダウンロード完了'}
            <button
              type="button"
              className="primary"
              style={{ marginLeft: '0.75rem' }}
              onClick={() => void ApiClient.installUpdate()}
            >
              再起動してインストール
            </button>
          </div>
        )}
        {app.busyMessage && <div className="banner">{app.busyMessage}</div>}
        {app.errorMessage && (
          <div className="banner error" onClick={() => app.clearError()} role="button" tabIndex={0}>
            {app.errorMessage}
          </div>
        )}
        {app.updaterStatus.status === 'error' && app.updaterStatus.message && (
          <div className="banner error">{app.updaterStatus.message}</div>
        )}

        {app.page === 'dashboard' && <DashboardView app={app} />}
        {app.page === 'hub' && <CreatorHubView app={app} />}
        {app.page === 'cursor' && <CursorView />}
        {app.page === 'git' && <GitView app={app} />}
        {app.page === 'assets' && <AssetsView />}
        {app.page === 'settings' && <SettingsView app={app} />}
        {app.page === 'logs' && <LogsView />}
      </div>
    </div>
  );
}
