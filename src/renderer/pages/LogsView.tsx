/**
 * ログ View
 */
import { useEffect } from 'react';
import { useViewModel } from '../store/ViewModelBase';
import { LogsViewModel } from '../store/LogsViewModel';

export function LogsView() {
  const vm = useViewModel(() => new LogsViewModel());

  useEffect(() => {
    void vm.load();
  }, [vm]);

  return (
    <div className="page">
      <h2>ログ</h2>
      <p className="lead">全操作の履歴（SQLite に保存）</p>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => void vm.load()}>
          再読み込み
        </button>
        <button type="button" className="danger" onClick={() => void vm.clear()}>
          クリア
        </button>
      </div>

      <section className="panel">
        <table className="log-table">
          <thead>
            <tr>
              <th>時刻</th>
              <th>Level</th>
              <th>Category</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {vm.logs.map((log) => (
              <tr key={log.id}>
                <td className="meta">{new Date(log.createdAt).toLocaleString()}</td>
                <td className={`level-${log.level}`}>{log.level}</td>
                <td>{log.category}</td>
                <td>
                  {log.message}
                  {log.detail && <div className="meta mono">{log.detail}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vm.logs.length === 0 && <div className="empty">ログはありません</div>}
      </section>
    </div>
  );
}
