export default function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-harvest" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-line-strong">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
