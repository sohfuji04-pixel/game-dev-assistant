/**
 * ダッシュボード View
 * クイックアクション + 創作ハブ導線 + 最近のプロジェクトを統合。
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { DashboardViewModel } from '../store/DashboardViewModel';
import type { AppViewModel } from '../store/AppViewModel';
import { ApiClient } from '../services/ApiClient';

interface Props {
  app: AppViewModel;
}

export function DashboardView({ app }: Props) {
  const vm = useViewModel(() => new DashboardViewModel(app));

  useEffect(() => {
    void vm.load();
  }, [vm, app.currentProject?.path]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>ダッシュボード</h2>
          <p className="lead">プロジェクト・創作ツール・ビルドをここから素早く実行</p>
        </div>
        {app.currentProject && (
          <div className="project-pill" title={app.currentProject.path}>
            <span className="status-dot on" />
            {app.currentProject.name}
          </div>
        )}
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      <section className="quick-actions">
        <button type="button" className="qa-card primary-tone" onClick={() => void vm.openNew()}>
          <span className="qa-label">プロジェクト</span>
          <strong>フォルダを開く</strong>
        </button>
        <button
          type="button"
          className="qa-card"
          onClick={() => app.setPage('hub')}
          disabled={!app.currentProject}
        >
          <span className="qa-label">Creator Hub</span>
          <strong>創作ツール</strong>
        </button>
        <button type="button" className="qa-card" onClick={() => void vm.launchCursor()} disabled={vm.loading}>
          <span className="qa-label">IDE</span>
          <strong>Cursor 起動</strong>
        </button>
        <button
          type="button"
          className="qa-card"
          onClick={() => void vm.buildWindows()}
          disabled={vm.loading || !app.currentProject}
        >
          <span className="qa-label">Build</span>
          <strong>Windows</strong>
        </button>
        <button
          type="button"
          className="qa-card"
          onClick={() => void vm.buildAndroid()}
          disabled={vm.loading || !app.currentProject}
        >
          <span className="qa-label">Build</span>
          <strong>Android</strong>
        </button>
        {app.currentProject && (
          <button
            type="button"
            className="qa-card"
            onClick={() => void ApiClient.revealInFolder(app.currentProject!.path)}
          >
            <span className="qa-label">Explorer</span>
            <strong>フォルダ表示</strong>
          </button>
        )}
      </section>

      <div className="grid cols-2" style={{ marginTop: '1rem' }}>
        <section className="panel">
          <div className="panel-head">
            <h3>最近開いたプロジェクト</h3>
            <button type="button" className="ghost" onClick={() => void vm.openNew()}>
              追加
            </button>
          </div>
          {vm.recent.length === 0 ? (
            <div className="empty">まだありません — ぽこぽこ等のゲームプロジェクトを開いてください</div>
          ) : (
            <div className="list">
              {vm.recent.map((p) => (
                <div key={p.id} className="list-item">
                  <div className="list-item-main" onClick={() => void vm.openRecent(p)} role="button" tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void vm.openRecent(p);
                    }}
                  >
                    <div>{p.name}</div>
                    <div className="meta truncate">{p.path}</div>
                    <div className="meta">{new Date(p.lastOpenedAt).toLocaleString()}</div>
                  </div>
                  <div className="row">
                    <button type="button" onClick={() => void vm.openRecent(p)}>
                      開く
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void vm.openRecent(p).then(() => app.setPage('hub'));
                      }}
                    >
                      ハブ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h3>更新履歴</h3>
          {vm.changelog.length === 0 ? (
            <div className="empty">履歴なし</div>
          ) : (
            <div className="list">
              {vm.changelog.map((c) => (
                <div key={c.id} className="list-item">
                  <div>
                    <div>
                      <span className="chip">v{c.version}</span> {c.title}
                    </div>
                    <div className="meta">{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {app.watcherEvents.length > 0 && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <div className="panel-head">
            <h3>ファイル監視（最新）</h3>
            <span className="chip">{app.watcherEvents.length}</span>
          </div>
          <div className="list">
            {app.watcherEvents.slice(0, 6).map((e, i) => (
              <div key={`${e.path}-${e.timestamp}-${i}`} className="list-item compact">
                <div>
                  <span className="chip">{e.type}</span> <span className="meta">{e.extension}</span>
                  <div className="meta mono truncate">{e.path}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {vm.buildLog && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h3>ビルドログ</h3>
          <pre className="mono">{vm.buildLog.slice(-4000)}</pre>
        </section>
      )}
    </div>
  );
}
