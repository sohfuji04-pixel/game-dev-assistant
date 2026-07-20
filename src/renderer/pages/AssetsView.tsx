/**
 * Assets 管理 View
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { AssetsViewModel } from '../store/AssetsViewModel';
import type { AssetType } from '@shared/types';

const FILTERS: Array<{ id: AssetType | 'all'; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'image', label: '画像' },
  { id: 'bgm', label: 'BGM' },
  { id: 'se', label: 'SE' },
];

export function AssetsView() {
  const vm = useViewModel(() => new AssetsViewModel());

  useEffect(() => {
    void vm.load();
  }, [vm]);

  return (
    <div className="page">
      <h2>Assets 管理</h2>
      <p className="lead">画像 / BGM / SE — ドラッグ＆ドロップとサムネイル表示</p>

      {vm.message && <div className="banner">{vm.message}</div>}

      <div className="row" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={vm.filter === f.id ? 'primary' : ''}
            onClick={() => vm.setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button type="button" onClick={() => void vm.importViaDialog()}>
          ファイルを選択
        </button>
        <button type="button" onClick={() => void vm.openFolder()}>
          フォルダを開く
        </button>
      </div>

      <div
        className={`dropzone${vm.dragOver ? ' active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          vm.setDragOver(true);
        }}
        onDragLeave={() => vm.setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          vm.setDragOver(false);
          if (e.dataTransfer.files.length > 0) {
            void vm.importDropped(e.dataTransfer.files);
          }
        }}
      >
        ここに画像・音声ファイルをドロップ
      </div>

      <div className="asset-grid" style={{ marginTop: '1rem' }}>
        {vm.assets.map((a) => (
          <div key={a.id} className="asset-card">
            <div className="asset-thumb">
              {a.type === 'image' && a.thumbnailDataUrl ? (
                <img src={a.thumbnailDataUrl} alt={a.name} />
              ) : (
                <div className="placeholder">
                  {a.type.toUpperCase()}
                  <br />
                  {(a.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
            <div className="asset-body">
              <div className="name" title={a.name}>
                {a.name}
              </div>
              <button type="button" className="danger" onClick={() => void vm.remove(a.id)}>
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      {vm.assets.length === 0 && !vm.loading && (
        <div className="empty" style={{ marginTop: '1rem' }}>
          アセットはまだありません
        </div>
      )}
    </div>
  );
}
