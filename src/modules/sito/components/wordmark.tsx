/** Wordmark definitivo convertito in tracciati, fornito da Manuel. */
export function WordmarkSito({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/sito/dayalogue.svg"
      className={className ? `jm-sito-wordmark ${className}` : "jm-sito-wordmark"}
      alt="dayalogue"
      draggable={false}
    />
  );
}
