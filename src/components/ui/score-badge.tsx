import { LEVELS, scoreLevel } from "@/lib/places/score";
import { cn } from "@/lib/utils";

/** Pastille de score : rouge = presque aucune présence en ligne (bon prospect). */
export function ScoreBadge({ score, size = "md", className }: { score: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const level = LEVELS[scoreLevel(score)];
  return (
    <span
      title={`${level.label} (${score}/100)`}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold text-white tabular-nums",
        size === "sm" && "size-7 text-[0.7rem]",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
        className,
      )}
      style={{ backgroundColor: level.color }}
    >
      {score}
      <span className="sr-only"> sur 100 : {level.label}</span>
    </span>
  );
}

export function LevelLabel({ score }: { score: number }) {
  const level = LEVELS[scoreLevel(score)];
  return (
    <span className="text-xs font-semibold" style={{ color: level.color }}>
      {level.short}
    </span>
  );
}
