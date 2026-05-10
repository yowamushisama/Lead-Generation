/** Parse a createdBefore filter value into a Date.
 *  Accepts ISO dates (YYYY-MM-DD → end of that day UTC) or full ISO strings.
 */
export function parseCreatedBefore(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const endOfDay = new Date(`${value}T00:00:00.000Z`);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    endOfDay.setUTCMilliseconds(-1);
    return endOfDay;
  }
  return new Date(value);
}
