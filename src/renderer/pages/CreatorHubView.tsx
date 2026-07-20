/**
 * 創作ツールハブ View
 * カード一覧 → アプリ内 iframe でツール編集まで完結。
 */
import { useEffect, useRef } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { CreatorHubViewModel } from '../store/CreatorHubViewModel';
import type { AppViewModel } from '../store/AppViewModel';

interface Props {
  app: AppViewModel;
}

export function CreatorHubView({ app }: Props) {
  const vm = useViewModel(() => new CreatorHubViewModel(app));
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    void vm.load();
  }, [vm, app.currentProject?.path]);

  // プロジェクト切替時は埋め込みツールを閉じる
  useEffect(() => {
    vm.closeTool();
  }, [vm, app.currentProject?.path]);

  const tools = vm.scan?.tools ?? [];
  const pipelines = vm.scan?.pipelines ?? [];

  if (vm.isToolOpen && vm.activeUrl) {
    return (
      <div className="tool-workspace">
        <header className="tool-chrome">
          <button type="button" className="primary" onClick={() => vm.closeTool()}>
            ← ハブに戻る
          </button>
          <div className="tool-chrome-title">
            {vm.activeTool && (
              <span className="tool-kicker" style={{ color: vm.activeTool.tone }}>
                {vm.activeTool.kicker}
              </span>
            )}
            <strong>{vm.activeTitle}</strong>
            {vm.iframeLoading && <span className="meta">読み込み中…</span>}
          </div>
          <div className="row">
            <button type="button" onClick={() => vm.refreshTool()} title="再読み込み">
              再読込
            </button>
            <button type="button" onClick={() => void vm.openInCursor()}>
              Cursor
            </button>
            <button type="button" onClick={() => void vm.openExternal()} title="外部ブラウザ（任意）">
              外部表示
            </button>
          </div>
        </header>

        {vm.message && <div className="banner tool-banner">{vm.message}</div>}

        <iframe
          key={vm.iframeKey}
          ref={iframeRef}
          className="tool-frame"
          title={vm.activeTitle}
          src={vm.activeUrl}
          onLoad={() => {
            let href: string | undefined;
            try {
              href = iframeRef.current?.contentWindow?.location.href;
            } catch {
              href = undefined;
            }
            vm.onIframeLoaded(href);
          }}
        />
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
            ツールはアプリ内で開きます。ブラウザへの切り替えは不要です。
            {vm.scan?.kind === 'pokopoko' && ' （ぽこぽこプロジェクトを検出）'}
          </p>
        </div>
        <div className="hub-status">
          <span className={`status-dot${vm.server.running ? ' on' : ''}`} />
          {vm.server.running
            ? `配信中 · ${vm.server.baseUrl}`
            : 'ツール選択時に自動起動'}
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
            {vm.server.running && (
              <button type="button" onClick={() => void vm.stopServer()}>
                配信停止
              </button>
            )}
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
                  <span className="hub-card-action">アプリ内で開く →</span>
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
