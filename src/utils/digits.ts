// Persian/Arabic-Indic numeral keyboards are common on Iranian Android devices — even a
// "numeric"/"decimal-pad" TextInput can emit ۰-۹ or ٠-٩ instead of ASCII digits, which
// Number() and parseFloat() silently read as NaN. Normalize to ASCII before parsing.
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toEnglishDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex !== -1) return String(persianIndex);
    return String(ARABIC_INDIC_DIGITS.indexOf(char));
  })
    .replace(/[٫٬]/g, '.');
}
