import type { AppUser, GroupStats } from "@/types";
import { groupAnalysisText } from "@/lib/admin-analytics";

export function GroupAnalysis({
  users,
  stats,
}: {
  users: AppUser[];
  stats: GroupStats;
}) {
  const text = groupAnalysisText(users, stats);
  return (
    <div className="card bg-gradient-to-br from-primary/10 to-aqua/10 p-6">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🔮
        </span>
        <h3 className="font-display text-lg font-semibold">Lectura del grupo</h3>
      </div>
      <p className="mt-3 leading-relaxed text-fg/90">{text}</p>
    </div>
  );
}
