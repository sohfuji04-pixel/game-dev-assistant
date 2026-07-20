/**
 * ChatGPT View
 */
import { useEffect, useRef } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { ChatGptViewModel, CHAT_MODE_OPTIONS } from '../store/ChatGptViewModel';
import type { AppViewModel } from '../store/AppViewModel';
import { renderSimpleMarkdown } from '../utils/markdown';

interface Props {
  app: AppViewModel;
}

export function ChatGptView({ app }: Props) {
  const vm = useViewModel(() => new ChatGptViewModel(app));
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void vm.load();
    return () => vm.dispose();
  }, [vm]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [vm.messages.length, vm.messages[vm.messages.length - 1]?.content]);

  return (
    <div className="page chatgpt-page">
      <header className="page-header">
        <div>
          <h2>ChatGPT</h2>
          <p className="lead">ゲーム開発向け AI チャット（ストリーミング・モード切替・履歴）</p>
        </div>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="ai-mode-bar">
        {CHAT_MODE_OPTIONS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`chip-btn${vm.mode === m.id ? ' active' : ''}`}
            onClick={() => void vm.setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="chatgpt-layout">
        <aside className="panel chatgpt-sidebar">
          <button type="button" className="primary" onClick={() => void vm.newChat()}>
            新しいチャット
          </button>
          <input
            className="chat-search"
            placeholder="チャット検索…"
            value={vm.search}
            onChange={(e) => vm.setSearch(e.target.value)}
          />
          <div className="chat-thread-list">
            {vm.threads.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`thread-item${t.id === vm.activeThreadId ? ' active' : ''}`}
                onClick={() => void vm.selectThread(t.id)}
              >
                <strong>{t.title}</strong>
                <span className="meta">{t.mode}</span>
              </button>
            ))}
            {vm.threads.length === 0 && <div className="empty">履歴はありません</div>}
          </div>
        </aside>

        <section className="panel chatgpt-main glass-panel">
          <div className="chatgpt-toolbar row">
            <button type="button" disabled={!vm.activeThreadId} onClick={() => void vm.deleteActive()}>
              会話削除
            </button>
            <button type="button" disabled={vm.busy || !vm.activeThreadId} onClick={() => void vm.regenerate()}>
              再生成
            </button>
            <button type="button" disabled={!vm.busy} onClick={() => void vm.stop()}>
              停止
            </button>
          </div>

          <div className="chatgpt-log">
            {vm.messages.length === 0 ? (
              <div className="empty">メッセージを入力して送信してください</div>
            ) : (
              vm.messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.role}`}>
                  <div className="chat-role">{m.role === 'user' ? 'あなた' : 'AI'}</div>
                  <div
                    className="chat-content md-body"
                    dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(m.content) }}
                  />
                  <div className="row" style={{ marginTop: '0.35rem' }}>
                    <button type="button" className="ghost" onClick={() => void vm.copy(m.content)}>
                      コピー
                    </button>
                    {m.status === 'streaming' && <span className="meta">生成中…</span>}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="chatgpt-input"
            onSubmit={(e) => {
              e.preventDefault();
              void vm.send();
            }}
          >
            <textarea
              ref={textareaRef}
              value={vm.draft}
              rows={3}
              placeholder="メッセージ…（Enter 送信 / Shift+Enter 改行）"
              disabled={vm.busy}
              onChange={(e) => vm.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void vm.send();
                }
              }}
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
