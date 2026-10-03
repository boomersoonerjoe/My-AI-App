export interface DeviceContext {
  isoTime: string;
  localDate: string;
  localTime: string;
  weekday: string;
  timeZone: string;
  utcOffset: string;
}
export function deviceContext(now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'): DeviceContext {
  const date = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => date.find(p => p.type === type)!.value;
  return {
    isoTime: now.toISOString(), localDate: `${part('year')}-${part('month')}-${part('day')}`,
    localTime: new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now),
    weekday: new Intl.DateTimeFormat('en', { timeZone, weekday: 'long' }).format(now), timeZone,
    utcOffset: new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')!.value,
  };
}
export function isDeviceClockQuestion(text: string) {
  const normalized = text.toLowerCase().trim().replace(/[?!.,]+$/g, '').replace(/’/g, "'").replace(/\s+/g, ' ');
  return /^what (?:time|date|day) is it(?: today| now)?$/.test(normalized) || /^(?:what(?:'s| is)(?: the)? (?:current |local |device |today's )?(?:date and time|time and date|date|time|day|timezone|time zone)(?: is it| am i in)?(?: today| now| on (?:my |this )?(?:device|mac|computer|phone))?|what day is (?:it|today)|what is today's date|tell me (?:the |my )?(?:current |local )?(?:date and time|time and date|date|time|timezone|time zone)|what timezone am i in)$/.test(normalized);
}
export function clockAnswer(clock: DeviceContext) {
  return `Device clock: ${clock.weekday}, ${clock.localDate}, ${clock.localTime} (${clock.utcOffset}).\nTime zone: ${clock.timeZone}.\nThis comes from your device and works without internet; it depends on your device clock being correct.`;
}
