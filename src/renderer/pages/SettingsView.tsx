/**
 * 設定画面 View
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { SettingsViewModel } from '../store/SettingsViewModel';
import type { AppViewModel } from '../store/AppViewModel';
import type { AppTheme, UpdateChannel } from '@shared/types';

interface Props {
  app: AppViewModel;
}

export function SettingsView({ app }: Props) {
  const vm = useViewModel(() => new SettingsViewModel(app));

  useEffect(() => {
    void vm.load();
  }, [vm]);

  if (!vm.draft) {
    return (
      <div className="page">
        <h2>設定</h2>
        <div className="empty">読み込み中…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>設定</h2>
      <p className="lead">一般 / GitHub 更新 / パス設定（アップデート後も userData に保持）</p>

      {vm.message && (
        <div className={`banner${vm.updater.status === 'available' ? ' warn' : ''}`}>{vm.message}</div>
      )}

      <div className="grid cols-2">
        <section className="panel stack">
          <h3>一般</h3>
          <div className="field">
            <label>テーマ</label>
            <select
              value={vm.draft.theme}
              onChange={(e) => vm.setTheme(e.target.value as AppTheme)}
            >
              <option value="dark">ダーク</option>
              <option value="light">ライト</option>
              <option value="system">システム</option>
            </select>
          </div>
          <div className="field">
            <label>データ保存場所</label>
            <div className="row">
              <input
                value={vm.draft.dataPath}
                onChange={(e) => vm.updateField('dataPath', e.target.value)}
              />
              <button type="button" onClick={() => void vm.browse('dataPath', true, 'データ保存場所')}>
                参照
              </button>
            </div>
          </div>
          <div className="field">
            <label>Cursor.exe</label>
            <div className="row">
              <input
                value={vm.draft.cursorExePath}
                onChange={(e) => vm.updateField('cursorExePath', e.target.value)}
              />
              <button
                type="button"
                onClick={() => void vm.browse('cursorExePath', false, 'Cursor.exe を選択')}
              >
                参照
              </button>
            </div>
          </div>
          <div className="field">
            <label>Git 実行パス</label>
            <input
              value={vm.draft.gitPath}
              onChange={(e) => vm.updateField('gitPath', e.target.value)}
              placeholder="git"
            />
          </div>
          <div className="field">
            <label>Android SDK</label>
            <div className="row">
              <input
                value={vm.draft.androidSdkPath}
                onChange={(e) => vm.updateField('androidSdkPath', e.target.value)}
              />
              <button
                type="button"
                onClick={() => void vm.browse('androidSdkPath', true, 'Android SDK')}
              >
                参照
              </button>
            </div>
          </div>
          <button type="button" className="primary" disabled={vm.saving} onClick={() => void vm.save()}>
            設定を保存
          </button>
        </section>

        <section className="panel stack">
          <h3>GitHub / 自動更新</h3>
          <div className="field">
            <label>GitHub Owner</label>
            <input
              value={vm.draft.updateOwner}
              onChange={(e) => vm.updateField('updateOwner', e.target.value)}
              placeholder="your-github-username"
            />
          </div>
          <div className="field">
            <label>GitHub Repository</label>
            <input
              value={vm.draft.updateRepo}
              onChange={(e) => vm.updateField('updateRepo', e.target.value)}
              placeholder="game-dev-assistant"
            />
          </div>
          <div className="field">
            <label>Update Channel</label>
            <select
              value={vm.draft.updateChannel}
              onChange={(e) => vm.updateField('updateChannel', e.target.value as UpdateChannel)}
            >
              <option value="latest">latest（安定版）</option>
              <option value="beta">beta</option>
              <option value="alpha">alpha</option>
            </select>
          </div>
          <label className="row" style={{ gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={vm.draft.autoUpdate}
              onChange={(e) => vm.updateField('autoUpdate', e.target.checked)}
            />
            起動時に自動更新チェック（Auto Update）
          </label>
          <div className="field">
            <label>失敗時の再試行回数</label>
            <input
              type="number"
              min={0}
              max={10}
              value={vm.draft.updateRetryCount}
              onChange={(e) => vm.updateField('updateRetryCount', Number(e.target.value) || 0)}
            />
          </div>

          <div className="meta">
            状態: {vm.updater.status}
            {vm.updater.version ? ` / v${vm.updater.version}` : ''}
          </div>
          {vm.updater.status === 'available' && (
            <div className="banner warn">新しいバージョンがあります</div>
          )}
          {typeof vm.updater.progress === 'number' && (
            <div className="meta">進捗: {vm.updater.progress.toFixed(1)}%</div>
          )}
          <div className="row">
            <button type="button" onClick={() => void vm.checkUpdate()}>
              更新確認
            </button>
            <button type="button" onClick={() => void vm.downloadUpdate()}>
              ダウンロード
            </button>
            <button type="button" className="primary" onClick={() => void vm.installUpdate()}>
              再起動してインストール
            </button>
          </div>

          <h3 style={{ marginTop: '1rem' }}>プラグイン</h3>
          {vm.plugins.map((p) => (
            <div key={p.id} className="list-item">
              <div>
                <div>
                  {p.name} <span className="chip">v{p.version}</span>
                </div>
                <div className="meta">{p.description}</div>
              </div>
              <button type="button" onClick={() => void vm.pingPlugin(p.id)}>
                ping
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
