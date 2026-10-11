import type {Locale} from './config';
import ruMessages from '@/src/messages/ru';

type MessageValue<T> = T extends string
    ? string
    : T extends readonly (infer Item)[]
        ? ReadonlyArray<MessageValue<Item>>
        : T extends Record<string, unknown>
            ? MessageShape<T>
            : T;

type MessageShape<T> = {
    [Key in keyof T]: MessageValue<T[Key]>;
};

export type AppMessages = MessageShape<typeof ruMessages>;

export async function loadMessages(locale: Locale): Promise<AppMessages> {
    switch (locale) {
        case 'en':
            return (await import('@/src/messages/en')).default;
        case 'kk':
            return (await import('@/src/messages/kk')).default;
        case 'ru':
        default:
            return (await import('@/src/messages/ru')).default;
    }
}
