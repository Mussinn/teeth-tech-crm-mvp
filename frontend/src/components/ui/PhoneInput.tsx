'use client';

import {
    type ChangeEvent,
    type InputHTMLAttributes,
    useRef,
} from 'react';
import {useTranslations} from 'next-intl';

import {
    formatPhoneNumber,
    getNationalPhoneDigits,
    PHONE_NUMBER_PATTERN,
} from '@/src/utils/phone';

type PhoneInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'inputMode' | 'maxLength' | 'onChange' | 'pattern' | 'type' | 'value'
> & {
    value: string;
    onValueChange: (value: string) => void;
};

function getCaretPosition(formattedValue: string, nationalDigitsBeforeCaret: number): number {
    const totalDigits = getNationalPhoneDigits(formattedValue).length;

    if (nationalDigitsBeforeCaret >= totalDigits) return formattedValue.length;
    if (nationalDigitsBeforeCaret <= 0) return Math.min(4, formattedValue.length);

    let seenDigits = 0;

    // Start after the fixed +7 prefix so its digit is not counted as part of the number.
    for (let index = 2; index < formattedValue.length; index += 1) {
        if (/\d/.test(formattedValue[index])) seenDigits += 1;
        if (seenDigits === nationalDigitsBeforeCaret) return index + 1;
    }

    return formattedValue.length;
}

export default function PhoneInput({
    value,
    onValueChange,
    autoComplete,
    placeholder,
    title,
    ...inputProps
}: PhoneInputProps) {
    const t = useTranslations('common');
    const inputRef = useRef<HTMLInputElement>(null);
    const formattedValue = formatPhoneNumber(value);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const rawValue = event.target.value;
        const selectionStart = event.target.selectionStart ?? rawValue.length;
        const inputType = (event.nativeEvent as InputEvent).inputType;
        let nationalDigitsBeforeCaret = getNationalPhoneDigits(
            rawValue.slice(0, selectionStart)
        ).length;
        let nextValue = formatPhoneNumber(rawValue);

        // If Backspace removed only a generated separator, remove the preceding digit too.
        if (
            inputType === 'deleteContentBackward'
            && nextValue === formattedValue
            && nationalDigitsBeforeCaret > 0
        ) {
            const digits = getNationalPhoneDigits(formattedValue);
            const digitIndex = nationalDigitsBeforeCaret - 1;
            nextValue = formatPhoneNumber(
                digits.slice(0, digitIndex) + digits.slice(digitIndex + 1)
            );
            nationalDigitsBeforeCaret -= 1;
        }

        onValueChange(nextValue);

        requestAnimationFrame(() => {
            const caretPosition = getCaretPosition(nextValue, nationalDigitsBeforeCaret);
            inputRef.current?.setSelectionRange(caretPosition, caretPosition);
        });
    };

    return (
        <input
            {...inputProps}
            ref={inputRef}
            type="tel"
            inputMode="tel"
            autoComplete={autoComplete ?? 'tel'}
            value={formattedValue}
            onChange={handleChange}
            pattern={PHONE_NUMBER_PATTERN}
            placeholder={placeholder ?? '+7 (___) ___ __ __'}
            title={title ?? t('phoneFormatHint')}
        />
    );
}
