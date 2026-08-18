/** Preference flag so tablet nav can open Calendar without route params. */

let preferCalendar = false;

export function requestCalendarView() {
  preferCalendar = true;
}

export function consumeCalendarViewRequest() {
  const value = preferCalendar;
  preferCalendar = false;
  return value;
}
