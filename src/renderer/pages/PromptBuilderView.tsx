/**
 * Prompt Builder View
 */
import { useViewModel } from '../store/ViewModelBase';
import { PromptBuilderViewModel } from '../store/PromptBuilderViewModel';
import type { AppViewModel } from '../store/AppViewModel';

interface Props {
  app: AppViewModel;
}

export function PromptBuilderView({ app }: Props) {
  const vm = useViewModel(() => new PromptBuilderViewModel(app));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Prompt Builder</h2>
          <p className="lead">Cursor へ送る高品質プロンプトを AI が生成します</p>
        </div>
      </header>

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="grid cols-2">
        <section className="panel stack glass-panel">
          <div className="field">
            <label>ゲーム内容</label>
            <textarea
              rows={5}
              value={vm.gameContent}
              onChange={(e) => vm.setField('gameContent', e.target.value)}
              placeholder="例: 癒し系牧場パズル…"
            />
          </div>
          <div className="field">
            <label>作業内容</label>
            <textarea
              rows={5}
              value={vm.workContent}
              onChange={(e) => vm.setField('workContent', e.target.value)}
              placeholder="例: 盤面エディタに障害物レイヤーを追加…"
            />
          </div>
          <div className="field">
            <label>使用言語</label>
            <input
              value={vm.language}
              onChange={(e) => vm.setField('language', e.target.value)}
              placeholder="TypeScript / C# / Python"
            />
          </div>
          <div className="row">
            <button type="button" className="primary" disabled={vm.busy} onClick={() => void vm.generate()}>
              {vm.busy ? '生成中…' : '生成'}
            </button>
            <button type="button" disabled={!vm.result} onClick={() => void vm.copy()}>
              コピー
            </button>
            <button type="button" className="primary" disabled={!vm.result} onClick={() => void vm.sendToCursor()}>
              Cursor へ送る
            </button>
          </div>
        </section>

        <section className="panel glass-panel">
          <h3>生成結果</h3>
          <pre className="mono hub-log" style={{ minHeight: 280, whiteSpace: 'pre-wrap' }}>
            {vm.result || 'まだ生成されていません'}
          </pre>
        </section>
      </div>
    </div>
  );
}
