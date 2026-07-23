/**
 * Calcule la date du jour au format YYYY-MM-DD selon le fuseau horaire Pacifique (America/Los_Angeles).
 * Les quotas Gemini Google AI Studio se réinitialisent à minuit en heure Pacifique.
 */
export function getPacificDateString(date: Date = new Date()): string {
  // Format string in Pacific timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Output format: YYYY-MM-DD
}
