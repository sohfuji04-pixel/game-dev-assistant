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
        <div
          className={`banner${
            vm.updater.status === 'available'
              ? ' warn'
              : vm.updater.status === 'error'
                ? ' error'
                : ''
          }`}
        >
          {vm.message}
        </div>
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
            {vm.cursorStatus && (
              <div className={`conn-hint${vm.cursorStatus.ok ? ' ok' : ' ng'}`}>
                <span className={`status-dot${vm.cursorStatus.ok ? ' on' : ' off'}`} />
                {vm.cursorStatus.message}
              </div>
            )}
          </div>
          <div className="field">
            <label>Git 実行パス</label>
            <input
              value={vm.draft.gitPath}
              onChange={(e) => vm.updateField('gitPath', e.target.value)}
              placeholder="git"
            />
            {vm.gitStatus && (
              <div className={`conn-hint${vm.gitStatus.ok ? ' ok' : ' ng'}`}>
                <span className={`status-dot${vm.gitStatus.ok ? ' on' : ' off'}`} />
                {vm.gitStatus.message}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={vm.checkingConnections}
            onClick={() => void vm.checkConnections()}
          >
            {vm.checkingConnections ? '接続確認中…' : 'Git / Cursor 接続を確認'}
          </button>
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
          <h3 style={{ marginTop: '0.5rem' }}>Blender AI</h3>
          <div className="field">
            <label>Blender.exe</label>
            <div className="row">
              <input
                value={vm.draft.blenderExePath}
                onChange={(e) => vm.updateField('blenderExePath', e.target.value)}
              />
              <button
                type="button"
                onClick={() => void vm.browse('blenderExePath', false, 'Blender.exe を選択')}
              >
                参照
              </button>
            </div>
          </div>
          <div className="field">
            <label>ブリッジ Host / Port</label>
            <div className="row">
              <input
                value={vm.draft.blenderHost}
                onChange={(e) => vm.updateField('blenderHost', e.target.value)}
                placeholder="127.0.0.1"
              />
              <input
                type="number"
                style={{ maxWidth: '7rem' }}
                value={vm.draft.blenderPort}
                onChange={(e) => vm.updateField('blenderPort', Number(e.target.value) || 8775)}
              />
            </div>
            <div className="meta">既定 8775（Unity Bridge 8765 と衝突しないよう分離）</div>
          </div>
          <label className="row" style={{ gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={vm.draft.autoReconnectBlender}
              onChange={(e) => vm.updateField('autoReconnectBlender', e.target.checked)}
            />
            Blender 切断時に自動再接続
          </label>
          <div className="field">
            <label>OpenAI API Key（任意）</label>
            <input
              type="password"
              value={vm.draft.openaiApiKey}
              onChange={(e) => vm.updateField('openaiApiKey', e.target.value)}
              placeholder="未設定でもテンプレートは利用可"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label>OpenAI Model</label>
            <input
              value={vm.draft.openaiModel}
              onChange={(e) => vm.updateField('openaiModel', e.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>
          <h3 style={{ marginTop: '0.5rem' }}>Unity AI</h3>
          <div className="field">
            <label>Unity Bridge URL</label>
            <input
              value={vm.draft.unityWsUrl}
              onChange={(e) => vm.updateField('unityWsUrl', e.target.value)}
              placeholder="ws://127.0.0.1:8765/unity/"
            />
          </div>
          <div className="field">
            <label>Unity Editor.exe（任意）</label>
            <div className="row">
              <input
                value={vm.draft.unityEditorPath}
                onChange={(e) => vm.updateField('unityEditorPath', e.target.value)}
              />
              <button
                type="button"
                onClick={() => void vm.browse('unityEditorPath', false, 'Unity.exe を選択')}
              >
                参照
              </button>
            </div>
          </div>
          <div className="field">
            <label>Unity プロジェクトパス（任意）</label>
            <div className="row">
              <input
                value={vm.draft.unityProjectPath}
                onChange={(e) => vm.updateField('unityProjectPath', e.target.value)}
              />
              <button
                type="button"
                onClick={() => void vm.browse('unityProjectPath', true, 'Unity プロジェクト')}
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
            状態: {vm.updater.status === 'not-available' ? '利用不可（問題なし）' : vm.updater.status}
            {vm.updater.version ? ` / v${vm.updater.version}` : ''}
          </div>
          {vm.updater.message && vm.updater.status !== 'idle' && vm.updater.status !== 'error' && (
            <div className="meta">{vm.updater.message}</div>
          )}
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
