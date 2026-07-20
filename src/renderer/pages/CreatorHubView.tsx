/**
 * 創作ツールハブ View
 * 専用画面はメインプロセスの WebContentsView（file://）で表示。再起動不要。
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { CreatorHubViewModel } from '../store/CreatorHubViewModel';
import { ApiClient } from '../services/ApiClient';
import type { AppViewModel } from '../store/AppViewModel';

interface Props {
  app: AppViewModel;
}

function readHostBounds(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function CreatorHubView({ app }: Props) {
  const vm = useViewModel(() => new CreatorHubViewModel(app));
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void vm.load();
  }, [vm, app.currentProject?.path]);

  useEffect(() => {
    void vm.closeTool();
  }, [vm, app.currentProject?.path]);

  useEffect(() => {
    if (!app.hubPendingToolId || !vm.scan || vm.loading) return;
    const id = app.consumeHubPendingToolId();
    if (id) void vm.openToolById(id);
  }, [app.hubPendingToolId, vm, vm.scan, vm.loading]);

  useEffect(() => {
    if (!app.hubCloseRequest) return;
    app.acknowledgeHubCloseRequest();
    void vm.closeTool();
  }, [app.hubCloseRequest, app, vm]);

  // ページ離脱時にネイティブビューを残さない
  useEffect(() => {
    return () => {
      void ApiClient.hubHideToolView().catch(() => undefined);
    };
  }, []);

  // ツール表示中: ホスト領域に合わせて WebContentsView を載せる
  useLayoutEffect(() => {
    if (!vm.isToolOpen || !hostRef.current) return;
    const el = hostRef.current;
    const bounds = readHostBounds(el);
    void vm.mountToolView(bounds);

    const onResize = () => {
      if (!hostRef.current) return;
      void vm.updateToolBounds(readHostBounds(hostRef.current));
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [vm, vm.isToolOpen, vm.activeHtmlPath]);

  // 他ページへ遷移したらネイティブビューを閉じる
  useEffect(() => {
    if (app.page !== 'hub' && vm.isToolOpen) {
      void vm.closeTool();
    }
  }, [app.page, vm]);

  const tools = vm.scan?.tools ?? [];
  const pipelines = vm.scan?.pipelines ?? [];

  if (vm.isToolOpen) {
    return (
      <div className="tool-workspace">
        <header className="tool-chrome">
          <button type="button" className="primary" onClick={() => void vm.closeTool()}>
            ← ハブに戻る
          </button>
          <div className="tool-chrome-title">
            {vm.activeTool && (
              <span className="tool-kicker" style={{ color: vm.activeTool.tone }}>
                {vm.activeTool.kicker}
              </span>
            )}
            <strong>{vm.activeTitle}</strong>
            <span className="chip">アプリ内画面</span>
            {vm.toolLoading && <span className="meta">読み込み中…</span>}
          </div>
          <div className="row">
            <button type="button" onClick={() => void vm.refreshTool()} title="再読み込み">
              再読込
            </button>
            <button type="button" onClick={() => void vm.openInCursor()}>
              Cursor
            </button>
            <button type="button" onClick={() => void vm.openExternal()} title="OS 既定アプリで開く">
              外部表示
            </button>
          </div>
        </header>

        {vm.message && <div className="banner tool-banner">{vm.message}</div>}

        <div ref={hostRef} className="tool-frame tool-frame-host" aria-label={vm.activeTitle} />
      </div>
    );
  }

  return (
    <div className="page hub-page">
      <header className="hub-hero">
        <div>
          <p className="hub-kicker">Creator Hub</p>
          <h2>創作ツールハブ</h2>
          <p className="lead">
            各ツールはアプリ内の専用画面で開きます（ポート不要・再起動不要）。
            {vm.scan?.kind === 'pokopoko' && ' （ぽこぽこプロジェクトを検出）'}
          </p>
        </div>
        <div className="hub-status">
          <span className="status-dot on" />
          ポートなし · すぐ開ける
        </div>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      {!app.currentProject ? (
        <div className="panel empty-state">
          <p>プロジェクトを開くと創作ツールが表示されます。</p>
          <button type="button" className="primary" onClick={() => void app.openProject()}>
            プロジェクトを開く
          </button>
        </div>
      ) : (
        <>
          <div className="toolbar sticky-toolbar">
            <button type="button" onClick={() => void vm.openInCursor()}>
              Cursor で開く
            </button>
            <button type="button" onClick={() => void vm.revealProject()}>
              フォルダを表示
            </button>
            <button type="button" onClick={() => void vm.load()} disabled={vm.loading}>
              再スキャン
            </button>
          </div>

          {tools.length > 0 ? (
            <nav className="hub-grid" aria-label="創作ツール一覧">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className="hub-card"
                  style={{ ['--tone' as string]: tool.tone }}
                  onClick={() => void vm.openTool(tool.htmlPath, tool.title, tool)}
                  disabled={vm.loading}
                >
                  <span className="tool-kicker">{tool.kicker}</span>
                  <h3 className="tool-title">{tool.title}</h3>
                  <p className="tool-desc">{tool.description}</p>
                  <div className="tool-meta">
                    {tool.chips.map((chip) => (
                      <span key={chip} className="chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <span className="hub-card-action">専用画面で開く →</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="panel empty-state">
              <p>HTML ツールは見つかりませんでした。npm パイプラインのみ利用できます。</p>
            </div>
          )}

          {(vm.scan?.gameIndex || (vm.scan?.previewPages.length ?? 0) > 0) && (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h3>クイックリンク</h3>
              <div className="row">
                {vm.scan?.gameIndex && (
                  <button
                    type="button"
                    onClick={() => void vm.openTool(vm.scan!.gameIndex!, '本編ゲーム')}
                  >
                    本編ゲーム
                  </button>
                )}
                {vm.scan?.previewPages.map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    onClick={() => void vm.openTool(p.path, p.label)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {pipelines.length > 0 && (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h3>本編反映パイプライン</h3>
              <p className="meta" style={{ marginBottom: '0.75rem' }}>
                Studio で試した内容を npm script でプロジェクトに焼き込みます
              </p>
              <div className="pipeline-list">
                {pipelines.map((p) => (
                  <div key={p.id} className="list-item">
                    <div>
                      <div>{p.label}</div>
                      <div className="meta">
                        {p.description} · <code>npm run {p.npmScript}</code>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="primary"
                      disabled={vm.runningScript !== null}
                      onClick={() => void vm.runScript(p.npmScript)}
                    >
                      {vm.runningScript === p.npmScript ? '実行中…' : '実行'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {vm.lastLog && (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h3>実行ログ</h3>
              <pre className="mono hub-log">{vm.lastLog.slice(-5000)}</pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
