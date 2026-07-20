/**
 * Git View
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { GitViewModel } from '../store/GitViewModel';
import type { AppViewModel } from '../store/AppViewModel';

interface Props {
  app: AppViewModel;
}

export function GitView({ app }: Props) {
  const vm = useViewModel(() => new GitViewModel(app));

  useEffect(() => {
    if (app.currentProject) {
      void vm.refresh();
    } else {
      void vm.checkBinary();
    }
  }, [vm, app.currentProject?.path]);

  return (
    <div className="page">
      <h2>Git</h2>
      <p className="lead">Commit / Push / Pull / Branch / Release</p>

      {vm.connection && (
        <div className={`conn-hint${vm.connection.ok ? ' ok' : ' ng'}`} style={{ marginBottom: '0.75rem' }}>
          <span className={`status-dot${vm.connection.ok ? ' on' : ' off'}`} />
          {vm.connection.message}
        </div>
      )}

      {vm.message && <div className="banner">{vm.message}</div>}

      {!app.currentProject ? (
        <div className="empty">ダッシュボードからプロジェクトを開いてください</div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: '1rem' }}>
            <button type="button" onClick={() => void vm.refresh()} disabled={vm.loading}>
              状態を更新
            </button>
            <button type="button" onClick={() => void vm.pull()} disabled={vm.loading}>
              Pull
            </button>
            <button type="button" className="primary" onClick={() => void vm.push()} disabled={vm.loading}>
              Push
            </button>
          </div>

          <div className="grid cols-2">
            <section className="panel stack">
              <h3>ステータス</h3>
              {vm.status ? (
                <>
                  <div>
                    ブランチ: <strong>{vm.status.branch || '—'}</strong>
                    {!vm.status.isRepo && <span className="meta"> （Git リポジトリではありません）</span>}
                  </div>
                  <div className="meta">
                    ahead {vm.status.ahead} / behind {vm.status.behind}
                  </div>
                  <div className="meta">staged: {vm.status.staged.length}</div>
                  <div className="meta">modified: {vm.status.modified.length}</div>
                  <div className="meta">untracked: {vm.status.untracked.length}</div>
                </>
              ) : (
                <div className="empty">未取得</div>
              )}

              <div className="field">
                <label>コミットメッセージ</label>
                <input
                  value={vm.commitMessage}
                  onChange={(e) => vm.setCommitMessage(e.target.value)}
                  placeholder="例: feat: add player movement"
                />
              </div>
              <button type="button" className="primary" onClick={() => void vm.commit()}>
                Commit
              </button>
            </section>

            <section className="panel stack">
              <h3>Branch / Release</h3>
              {vm.branches && (
                <div className="list">
                  {vm.branches.all.map((b) => (
                    <div key={b} className="list-item">
                      <div>
                        {b === vm.branches?.current ? <strong>{b} (current)</strong> : b}
                      </div>
                      {b !== vm.branches?.current && (
                        <button type="button" onClick={() => void vm.checkout(b)}>
                          Checkout
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="field">
                <label>新規ブランチ</label>
                <div className="row">
                  <input
                    value={vm.newBranch}
                    onChange={(e) => vm.setNewBranch(e.target.value)}
                    placeholder="feature/..."
                  />
                  <button type="button" onClick={() => void vm.createBranch()}>
                    作成
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Release バージョン</label>
                <div className="row">
                  <input
                    value={vm.releaseVersion}
                    onChange={(e) => vm.setReleaseVersion(e.target.value)}
                    placeholder="1.2.0"
                  />
                  <button type="button" onClick={() => void vm.release()}>
                    Release
                  </button>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
