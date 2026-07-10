const STATUS = {
  documented: { label: "Documented", cls: "text-s_documented border-s_documented", glyph: "◆" },
  contacted: { label: "Letter sent", cls: "text-s_contacted border-s_contacted", glyph: "➤" },
  awaiting: { label: "Awaiting response", cls: "text-s_awaiting border-s_awaiting", glyph: "◐" },
  resolved: { label: "Resolved", cls: "text-s_resolved border-s_resolved", glyph: "✓" },
} as const;

export type BarrierStatus = keyof typeof STATUS;

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[(status as BarrierStatus) in STATUS ? (status as BarrierStatus) : "documented"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-2 bg-paper px-3 py-0.5 text-sm font-bold ${s.cls}`}>
      <span aria-hidden="true">{s.glyph}</span>
      {s.label}
    </span>
  );
}
