export function handleCoordinatePaste(
  e: React.ClipboardEvent<HTMLDivElement>,
  setLatitude: (value: string) => void,
  setLongitude: (value: string) => void,
) {
  const text = e.clipboardData.getData('text').trim();
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return;

  e.preventDefault();
  setLatitude(match[1]);
  setLongitude(match[2]);
}
