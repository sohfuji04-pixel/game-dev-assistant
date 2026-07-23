/**
 * ChatGPT View — 反映先指定対応
 */
import { useEffect, useRef } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import {
  ChatGptViewModel,
  CHAT_MODE_OPTIONS,
  CHAT_APPLY_TARGETS,
  type ChatApplyTarget,
} from '../store/ChatGptViewModel';
import type { AppViewModel } from '../store/AppViewModel';
import { renderSimpleMarkdown } from '../utils/markdown';

interface Props {
  app: AppViewModel;
}

export function ChatGptView({ app }: Props) {
  const vm = useViewModel(() => new ChatGptViewModel(app));
  const bottomRef = useRef<HTMLDivElement>(null);
  const targetLabel = vm.applyTargetMeta.label;

  useEffect(() => {
    void vm.load();
    return () => vm.dispose();
  }, [vm]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [vm.messages.length, vm.messages[vm.messages.length - 1]?.content]);

  const bannerClass =
    vm.messageKind === 'success'
      ? 'banner success'
      : vm.messageKind === 'error'
        ? 'banner error'
        : vm.messageKind === 'warn'
          ? 'banner warn'
          : 'banner';

  return (
    <div className="page chatgpt-page">
      <header className="page-header">
        <div>
          <h2>ChatGPT</h2>
          <p className="lead">返答をそのまま指定先へ反映できます</p>
        </div>
      </header>

      {vm.message && <div className={bannerClass}>{vm.message}</div>}

      <div className="ai-mode-bar" role="toolbar" aria-label="チャットモード">
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

      <section className="panel apply-target-bar glass-panel">
        <div className="apply-target-fields">
          <div className="field apply-field-target">
            <label htmlFor="chatgpt-apply-target">反映先</label>
            <select
              id="chatgpt-apply-target"
              value={vm.applyTarget}
              onChange={(e) => vm.setApplyTarget(e.target.value as ChatApplyTarget)}
            >
              {CHAT_APPLY_TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {vm.applyTarget === 'file' && (
            <div className="field apply-field-path">
              <label htmlFor="chatgpt-apply-path">保存パス（プロジェクト相対）</label>
              <input
                id="chatgpt-apply-path"
                value={vm.applyFilePath}
                onChange={(e) => vm.setApplyFilePath(e.target.value)}
                placeholder="ai-output/chatgpt-latest.md"
              />
            </div>
          )}
          <button
            type="button"
            className="primary apply-latest-btn"
            disabled={vm.applying || !vm.latestAssistantContent || !vm.canApplyFile}
            onClick={() => void vm.applyLatest()}
            title={!vm.canApplyFile ? 'プロジェクトを開いてください' : undefined}
          >
            {vm.applying ? '反映中…' : `最新を反映 → ${targetLabel}`}
          </button>
        </div>
        <p className="apply-hint">{vm.applyTargetMeta.hint}</p>
        {vm.applyTarget === 'file' && !vm.projectPath && (
          <p className="apply-hint warn">ファイル反映には、先にプロジェクトを開いてください</p>
        )}
      </section>

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
            aria-label="チャット検索"
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
                <span className="meta">{vm.modeLabel(t.mode)}</span>
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
              <div className="empty chatgpt-empty">
                メッセージを入力して送信してください。
                <br />
                AI 返答の「反映」で、上で選んだ反映先へそのまま送れます。
              </div>
            ) : (
              vm.messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.role}`}>
                  <div className="chat-role">{m.role === 'user' ? 'あなた' : 'AI'}</div>
                  <div
                    className="chat-content md-body"
                    dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(m.content) }}
                  />
                  <div className="row chat-bubble-actions">
                    <button type="button" className="ghost" onClick={() => void vm.copy(m.content)}>
                      コピー
                    </button>
                    {m.role === 'assistant' && m.status !== 'streaming' && (
                      <button
                        type="button"
                        className="primary"
                        disabled={vm.applying || !m.content.trim() || !vm.canApplyFile}
                        onClick={() => void vm.applyContent(m.content)}
                        title={!vm.canApplyFile ? 'プロジェクトを開いてください' : `反映先: ${targetLabel}`}
                      >
                        {vm.applying ? '反映中…' : `反映 → ${targetLabel}`}
                      </button>
                    )}
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
