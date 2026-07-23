/**
 * ゲーム UI 作成 AI View — ChatGPT（Web・APIキー不要）
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { UiCreateAiViewModel } from '../store/UiCreateAiViewModel';
import type { AppViewModel } from '../store/AppViewModel';
import type { UiThemeId } from '@shared/types';
import { renderSimpleMarkdown } from '../utils/markdown';

interface Props {
  app: AppViewModel;
}

export function UiCreateAiView({ app }: Props) {
  const vm = useViewModel(() => new UiCreateAiViewModel(app));

  useEffect(() => {
    void vm.load();
  }, [vm]);

  const palette = vm.previewPalette;

  return (
    <div className="page ui-create-page">
      <header className="page-header">
        <div>
          <h2>UI 作成 AI</h2>
          <p className="lead">
            OpenAI APIキーは不要です。「かわいい牧場ゲーム / ホーム画面」と入力し、ChatGPT
            で設計書を生成 → 返答を貼り付けてください
          </p>
        </div>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="grid cols-2 ui-create-grid">
        <section className="panel stack glass-panel">
          <div className="field">
            <label>自然言語入力</label>
            <textarea
              rows={5}
              value={vm.prompt}
              onChange={(e) => vm.setPrompt(e.target.value)}
              placeholder={'例:\nかわいい牧場ゲーム\nホーム画面'}
            />
          </div>

          <div className="field">
            <label>テーマテンプレート</label>
            <div className="ui-create-chips">
              <button
                type="button"
                className={`chip-btn${vm.themeId === 'auto' ? ' active' : ''}`}
                onClick={() => vm.setThemeId('auto')}
              >
                自動認識
              </button>
              {vm.themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip-btn${vm.themeId === t.id ? ' active' : ''}`}
                  title={t.description}
                  onClick={() => vm.setThemeId(t.id as UiThemeId)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>画面テンプレート</label>
            <select
              value={vm.screenId}
              onChange={(e) =>
                vm.setScreenId(e.target.value as typeof vm.screenId)
              }
            >
              <option value="auto">自動認識（入力から推定）</option>
              {vm.screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="row ui-create-options">
            <div className="field grow">
              <label>向き</label>
              <select
                value={vm.orientation}
                onChange={(e) =>
                  vm.setOrientation(e.target.value as 'portrait' | 'landscape')
                }
              >
                <option value="portrait">縦画面</option>
                <option value="landscape">横画面</option>
              </select>
            </div>
            <div className="field grow">
              <label>デバイス</label>
              <select
                value={vm.deviceTarget}
                onChange={(e) =>
                  vm.setDeviceTarget(e.target.value as 'phone' | 'tablet' | 'both')
                }
              >
                <option value="both">スマホ + タブレット</option>
                <option value="phone">Android スマホ</option>
                <option value="tablet">Android タブレット</option>
              </select>
            </div>
          </div>

          <label className="ui-create-check">
            <input
              type="checkbox"
              checked={vm.includeReview}
              onChange={(e) => vm.setIncludeReview(e.target.checked)}
            />
            生成依頼に UI 改善レビュー（⑪）を含める
          </label>

          {palette && (
            <div className="field">
              <label>カラーパレット</label>
              <div className="ui-create-palette">
                {(
                  [
                    ['Primary', palette.primary],
                    ['Secondary', palette.secondary],
                    ['Accent', palette.accent],
                    ['Background', palette.background],
                    ['Text', palette.text],
                    ['Warning', palette.warning],
                    ['Success', palette.success],
                  ] as const
                ).map(([name, color]) => (
                  <div key={name} className="ui-create-swatch" title={`${name}: ${color}`}>
                    <span style={{ background: color }} />
                    <small>{name}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="row wrap">
            <button
              type="button"
              className="primary"
              disabled={vm.busy || !vm.prompt.trim()}
              onClick={() => void vm.openWithChatGpt()}
            >
              {vm.busy ? '準備中…' : 'ChatGPT で生成'}
            </button>
            <button
              type="button"
              disabled={vm.busy || !vm.prompt.trim()}
              onClick={() => void vm.copyChatGptPrompt()}
            >
              プロンプトのみコピー
            </button>
          </div>

          <div className="field">
            <label>ChatGPT の返答を貼り付け</label>
            <textarea
              rows={8}
              value={vm.pasteDraft}
              onChange={(e) => vm.setPasteDraft(e.target.value)}
              placeholder="ChatGPT が返した Markdown をここに貼り付け…"
            />
          </div>

          <div className="row wrap">
            <button
              type="button"
              className="primary"
              disabled={vm.busy || !vm.pasteDraft.trim()}
              onClick={() => void vm.applyPaste()}
            >
              結果として取り込む
            </button>
            <button type="button" disabled={!vm.result} onClick={() => void vm.copy()}>
              全文コピー
            </button>
            <button
              type="button"
              disabled={!vm.result}
              onClick={() => void vm.copyCursorPrompt()}
            >
              Cursor プロンプト
            </button>
            <button
              type="button"
              className="primary"
              disabled={!vm.result || vm.busy}
              onClick={() => void vm.sendToCursor()}
            >
              Cursor へ送る
            </button>
            <button
              type="button"
              disabled={!vm.result || vm.busy}
              onClick={() => void vm.reReview()}
            >
              ChatGPT で改善レビュー
            </button>
          </div>

          {vm.chatGptPack && (
            <details className="ui-create-prompt-preview">
              <summary>ChatGPT へ送るプロンプト（プレビュー）</summary>
              <pre className="mono hub-log" style={{ whiteSpace: 'pre-wrap', maxHeight: 220 }}>
                {vm.chatGptPack.chatGptPrompt}
              </pre>
            </details>
          )}
        </section>

        <section className="panel glass-panel ui-create-result">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>生成結果</h3>
            {vm.result && (
              <span className="meta">
                {vm.result.detectedGenre} · {String(vm.result.appliedThemeId)} ·{' '}
                {String(vm.result.appliedScreenId)}
              </span>
            )}
          </div>
          {vm.result ? (
            <div
              className="ui-create-markdown"
              dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(vm.result.markdown) }}
            />
          ) : (
            <pre className="mono hub-log" style={{ minHeight: 280, whiteSpace: 'pre-wrap' }}>
              {`手順:
1. 「ChatGPT で生成」を押す（プロンプトをコピーして ChatGPT を開きます）
2. ChatGPT に貼り付けて送信
3. 返答を左の欄に貼り付け「結果として取り込む」`}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
