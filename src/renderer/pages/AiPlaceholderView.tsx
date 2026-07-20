/**
 * Image AI / Vision AI プレースホルダ
 */
interface Props {
  title: string;
  description: string;
}

export function AiPlaceholderView({ title, description }: Props) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>{title}</h2>
          <p className="lead">{description}</p>
        </div>
      </header>
      <section className="panel empty-state glass-panel">
        <p>この機能は Phase 2 で実装予定です。</p>
        <p className="meta">ChatGPT / Prompt Builder / Project Memory は利用できます。</p>
      </section>
    </div>
  );
}
