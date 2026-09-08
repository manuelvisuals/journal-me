/** Wordmark vettoriale del sito: stessi carattere e pesi del Marchio. */
export function WordmarkSito({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `jm-sito-wordmark ${className}` : "jm-sito-wordmark"}
      viewBox="0 0 166 42"
      role="img"
      aria-label="dayalogue"
    >
      <title>dayalogue</title>
      <text x="1" y="32" fontSize="34">
        <tspan fontWeight="600">day</tspan>
        <tspan fontWeight="400">alogue</tspan>
      </text>
    </svg>
  );
}
