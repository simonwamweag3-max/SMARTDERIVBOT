export type DigitFrequency = { digit: number; count: number; percentage: number };

/** Extract the final decimal digit from a Deriv quote without losing trailing zeroes. */
export function extractLastDigit(quote: string | number): number | null {
  const text = String(quote).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const digits = text.replace(".", "");
  const last = Number(digits.at(-1));
  return Number.isInteger(last) && last >= 0 && last <= 9 ? last : null;
}

/** Return percentage frequencies for digits 0–9. Invalid values are ignored. */
export function calculateDigitFrequencies(digits: readonly number[]): DigitFrequency[] {
  const counts = Array<number>(10).fill(0);
  let valid = 0;
  for (const digit of digits) {
    if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
      counts[digit] += 1;
      valid += 1;
    }
  }
  return counts.map((count, digit) => ({
    digit,
    count,
    percentage: valid === 0 ? 0 : (count / valid) * 100,
  }));
}

/** Descriptive sample share only; this is not a forecast or trading signal. */
export function sampleShare(frequencies: readonly DigitFrequency[], minDigit: number, maxDigit: number): number {
  if (!Number.isInteger(minDigit) || !Number.isInteger(maxDigit) || minDigit < 0 || maxDigit > 9 || minDigit > maxDigit) {
    throw new RangeError("Digit range must be an inclusive range from 0 to 9");
  }
  return frequencies
    .filter(item => item.digit >= minDigit && item.digit <= maxDigit)
    .reduce((total, item) => total + item.percentage, 0);
}
