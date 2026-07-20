/**
 * Cursor 連携 View
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { CursorViewModel } from '../store/CursorViewModel';

export function CursorView() {
  const vm = useViewModel(() => new CursorViewModel());

  useEffect(() => {
    void vm.load();
  }, [vm]);

  return (
    <div className="page">
      <h2>Cursor 連携</h2>
      <p className="lead">起動・フォルダオープン・Prompt 管理 / 履歴 / 検索</p>

      {vm.connection && (
        <div className={`conn-hint${vm.connection.ok ? ' ok' : ' ng'}`} style={{ marginBottom: '0.75rem' }}>
          <span className={`status-dot${vm.connection.ok ? ' on' : ' off'}`} />
          {vm.connection.message}
          {vm.connection.path ? (
            <span className="meta mono truncate" title={vm.connection.path}>
              {vm.connection.path}
            </span>
          ) : null}
        </div>
      )}

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="primary" onClick={() => void vm.launchCursor()}>
          Cursor を起動
        </button>
        <button type="button" onClick={() => void vm.openFolder()}>
          任意フォルダを開く
        </button>
        <button type="button" disabled={vm.checking} onClick={() => void vm.checkConnection()}>
          {vm.checking ? '確認中…' : '接続確認'}
        </button>
        <button type="button" onClick={() => vm.startCreate()}>
          新規 Prompt
        </button>
      </div>

      <div className="grid cols-2">
        <section className="panel stack">
          <h3>{vm.editing ? 'Prompt 編集' : 'Prompt 作成'}</h3>
          <div className="field">
            <label>タイトル</label>
            <input
              value={vm.draftTitle}
              onChange={(e) => vm.setDraftTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label>内容</label>
            <textarea
              value={vm.draftContent}
              onChange={(e) => vm.setDraftContent(e.target.value)}
            />
          </div>
          <div className="field">
            <label>タグ（カンマ区切り）</label>
            <input
              value={vm.draftTags}
              onChange={(e) => vm.setDraftTags(e.target.value)}
            />
          </div>
          <div className="row">
            <button type="button" className="primary" onClick={() => void vm.save()}>
              保存
            </button>
          </div>
        </section>

        <section className="panel stack">
          <h3>Prompt 一覧 / 検索</h3>
          <div className="row">
            <input
              placeholder="検索…"
              value={vm.searchQuery}
              onChange={(e) => vm.setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void vm.search();
              }}
            />
            <button type="button" onClick={() => void vm.search()}>
              検索
            </button>
          </div>
          {vm.prompts.length === 0 ? (
            <div className="empty">Prompt がありません</div>
          ) : (
            <div className="list">
              {vm.prompts.map((p) => (
                <div key={p.id} className="list-item">
                  <div>
                    <div>{p.title}</div>
                    <div className="meta">{p.tags.join(', ') || 'タグなし'}</div>
                  </div>
                  <div className="row">
                    <button type="button" onClick={() => void vm.usePrompt(p)}>
                      使用
                    </button>
                    <button type="button" onClick={() => vm.startEdit(p)}>
                      編集
                    </button>
                    <button type="button" className="danger" onClick={() => void vm.remove(p.id)}>
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h3>Prompt 履歴</h3>
        {vm.history.length === 0 ? (
          <div className="empty">履歴なし</div>
        ) : (
          <div className="list">
            {vm.history.map((h) => (
              <div key={h.id} className="list-item">
                <div>
                  <div>{h.title}</div>
                  <div className="meta">{new Date(h.usedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
