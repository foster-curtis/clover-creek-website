/**
 * A page's direct-answer paragraph (src/lib/answers.ts), rendered as its lead —
 * larger type and no card chrome, so it reads as the page's opening sentence
 * rather than a callout box.
 */
export default function AnswerBlock({ text, className }: { text: string; className?: string }) {
  return (
    <p className={`max-w-2xl text-lg leading-relaxed text-stone-700 ${className ?? ""}`}>{text}</p>
  );
}
