/**
 * Unity AI View — 接続・クイックコマンド・チャット
 */
import { useEffect, useRef } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { UnityViewModel } from '../store/UnityViewModel';

export function UnityView() {
  const vm = useViewModel(() => new UnityViewModel());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void vm.load();
    return () => vm.dispose();
  }, [vm]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [vm.messages.length, vm.messages[vm.messages.length - 1]?.content]);

  const connected = vm.connection?.connected;

  return (
    <div className="page blender-page">
      <header className="page-header">
        <div>
          <h2>Unity AI</h2>
          <p className="lead">日本語チャットで Unity Editor を操作（Bridge / ルールベース）</p>
        </div>
        <div className={`project-pill${connected ? '' : ' muted'}`}>
          <span className={`status-dot${connected ? ' on' : ' off'}`} />
          {connected
            ? `接続中 · ${vm.connection?.projectName ?? ''} ${vm.connection?.unityVersion ?? ''}`
            : '未接続'}
        </div>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="banner" style={{ fontSize: '0.85rem' }}>
        Unity で Package Manager → Add from disk →{' '}
        <span className="mono">{vm.packagePath || '…/unity-package'}</span>
        の <code>package.json</code> を追加し、メニュー「Unity AI Controller → Start Bridge」を実行してください（
        <code>ws://127.0.0.1:8765/unity/</code>）。Blender AI はポート 8775 を使います。
      </div>

      <div className="row" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="primary" disabled={vm.busy} onClick={() => void vm.connect()}>
          接続
        </button>
        <button type="button" disabled={vm.busy || !connected} onClick={() => void vm.disconnect()}>
          切断
        </button>
        <button type="button" className="ghost" onClick={() => void vm.clearChat()}>
          履歴クリア
        </button>
        {vm.connection?.activeScene && (
          <span className="chip">Scene: {vm.connection.activeScene}</span>
        )}
      </div>

      <div className="blender-layout">
        <section className="panel blender-templates">
          <h3>クイックコマンド</h3>
          <p className="meta">自然言語ルールで Editor API を実行</p>
          <div className="template-list">
            {vm.commands.map((c) => (
              <button
                key={c.id}
                type="button"
                className="template-btn"
                disabled={vm.busy}
                onClick={() => void vm.runQuick(c.id)}
                title={c.description}
              >
                <strong>{c.label}</strong>
                <span className="meta">{c.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel blender-chat">
          <h3>チャット</h3>
          <div className="chat-log">
            {vm.messages.length === 0 ? (
              <div className="empty">
                例: 「プレイヤーを追加」「敵を10体生成」「シーンを保存」「Canvasを追加」
              </div>
            ) : (
              vm.messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.role}`}>
                  <div className="chat-role">{m.role}</div>
                  <div className="chat-content">{m.content}</div>
                  {m.codeBlocks?.map((b, i) => (
                    <pre key={i} className="mono chat-code">
                      {b.code.slice(0, 1200)}
                    </pre>
                  ))}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void vm.send();
            }}
          >
            <input
              value={vm.draft}
              onChange={(e) => vm.setDraft(e.target.value)}
              placeholder="日本語で指示…"
              disabled={vm.busy}
            />
            <button type="submit" className="primary" disabled={vm.busy || !vm.draft.trim()}>
              送信
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
