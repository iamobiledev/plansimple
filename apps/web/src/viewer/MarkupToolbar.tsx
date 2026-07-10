import { DRAW_TOOLS, type DrawTool, type MarkupStyle, DEFAULT_STYLE } from "./markupTypes";

type Props = {
  tool: DrawTool;
  onTool: (t: DrawTool) => void;
  style: MarkupStyle;
  onStyle: (s: MarkupStyle) => void;
  subject: string;
  onSubject: (s: string) => void;
};

export default function MarkupToolbar({ tool, onTool, style, onStyle, subject, onSubject }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow">
      <div className="flex flex-wrap gap-1">
        {DRAW_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onTool(t.id)}
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              tool === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mx-1 h-6 w-px bg-slate-200" />
      <label className="flex items-center gap-1 text-xs text-slate-600">
        Color
        <input
          type="color"
          value={style.stroke || DEFAULT_STYLE.stroke}
          onChange={(e) => onStyle({ ...style, stroke: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        Width
        <input
          type="number"
          min={1}
          max={20}
          className="w-12 rounded border border-slate-200 px-1 py-0.5"
          value={style.strokeWidth ?? 2}
          onChange={(e) => onStyle({ ...style, strokeWidth: Number(e.target.value) })}
        />
      </label>
      <input
        className="min-w-[140px] flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
        placeholder="Subject"
        value={subject}
        onChange={(e) => onSubject(e.target.value)}
      />
    </div>
  );
}
