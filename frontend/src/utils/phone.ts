export const PHONE_NUMBER_PATTERN = String.raw`\+7 \(\d{3}\) \d{3} \d{2} \d{2}`;

const NATIONAL_PHONE_DIGITS_COUNT = 10;

export function getNationalPhoneDigits(value: string): string {
    const digits = value.replace(/\D/g, '');
    const hasExplicitCountryCode = /^\s*\+7/.test(value);

    if (hasExplicitCountryCode || (digits.length > NATIONAL_PHONE_DIGITS_COUNT && /^[78]/.test(digits))) {
        return digits.slice(1, NATIONAL_PHONE_DIGITS_COUNT + 1);
    }

    return digits.slice(0, NATIONAL_PHONE_DIGITS_COUNT);
}

export function formatPhoneNumber(value: string): string {
    const digits = getNationalPhoneDigits(value);

    if (!digits) return '';

    let formatted = `+7 (${digits.slice(0, 3)}`;

    if (digits.length >= 3) formatted += ')';
    if (digits.length > 3) formatted += ` ${digits.slice(3, 6)}`;
    if (digits.length > 6) formatted += ` ${digits.slice(6, 8)}`;
    if (digits.length > 8) formatted += ` ${digits.slice(8, 10)}`;

    return formatted;
}

export function isPhoneNumberComplete(value: string): boolean {
    return getNationalPhoneDigits(value).length === NATIONAL_PHONE_DIGITS_COUNT;
}
