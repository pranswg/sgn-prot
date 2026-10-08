export function formatMasterListPdfTimestamp(date: Date): string {
  const dateText = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date)
  const timeText = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(date)
  return `As of ${dateText} - ${timeText}`
}

export function paperSizePoints(widthMm: number, heightMm: number) {
  return {
    width: (widthMm * 72) / 25.4,
    height: (heightMm * 72) / 25.4,
  }
}
