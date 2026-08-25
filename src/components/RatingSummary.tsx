import Stars from "@/components/Stars";

export default function RatingSummary({ average, count }: { average: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <Stars rating={Math.round(average)} />
      <span className="font-semibold text-stone-800">{average.toFixed(1)}</span>
      <span className="text-sm text-stone-500">
        ({count} review{count === 1 ? "" : "s"})
      </span>
    </div>
  );
}
