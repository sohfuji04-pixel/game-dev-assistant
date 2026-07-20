/**
 * Blender AI View — 接続・テンプレート・チャット
 */
import { useEffect, useRef } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { BlenderViewModel } from '../store/BlenderViewModel';

export function BlenderView() {
  const vm = useViewModel(() => new BlenderViewModel());
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
          <h2>Blender AI</h2>
          <p className="lead">日本語チャットで Blender を操作（テンプレート / OpenAI）</p>
        </div>
        <div className={`project-pill${connected ? '' : ' muted'}`}>
          <span className={`status-dot${connected ? ' on' : ' off'}`} />
          {connected
            ? `接続中 · ${vm.connection?.blenderVersion ?? ''}`
            : '未接続'}
        </div>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="row" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="primary" disabled={vm.busy} onClick={() => void vm.launch()}>
          Blender 起動
        </button>
        <button type="button" disabled={vm.busy} onClick={() => void vm.connect()}>
          接続
        </button>
        <button type="button" disabled={vm.busy || !connected} onClick={() => void vm.disconnect()}>
          切断
        </button>
        <button type="button" className="ghost" onClick={() => void vm.clearChat()}>
          履歴クリア
        </button>
        {vm.exeCheck && (
          <span className={`conn-hint${vm.exeCheck.ok ? ' ok' : ' ng'}`}>
            <span className={`status-dot${vm.exeCheck.ok ? ' on' : ' off'}`} />
            {vm.exeCheck.message}
          </span>
        )}
      </div>

      <div className="blender-layout">
        <section className="panel blender-templates">
          <h3>テンプレート</h3>
          <p className="meta">APIキー無しでも実行できます</p>
          <div className="template-list">
            {vm.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className="template-btn"
                disabled={vm.busy}
                onClick={() => void vm.runTemplate(t.id)}
                title={t.description}
              >
                <span className="chip">{t.category}</span>
                <strong>{t.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="panel blender-chat">
          <h3>チャット</h3>
          <div className="chat-log">
            {vm.messages.length === 0 ? (
              <div className="empty">
                例: 「可愛い牧場少女を作成」「夕焼けに変更」「キューブを追加」
              </div>
            ) : (
              vm.messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.role}`}>
                  <div className="chat-role">{m.role}</div>
                  <div className="chat-content">{m.content}</div>
                  {typeof m.progress === 'number' && m.status === 'running' && (
                    <div className="meta">進捗 {m.progress}%</div>
                  )}
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
