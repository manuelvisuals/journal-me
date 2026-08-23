/**
 * Lo spillo della mappa davanti al nome di un luogo. Serve a distinguere a
 * colpo d'occhio un posto da una persona: le pastiglie sono le stesse, e
 * senza un segno "Charlie" e "da Charlie" si confondono.
 */
export function PlacePin() {
  return (
    <svg className="jm-pin" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
