import type {AppMessages} from './messages';
import type {Locale} from './config';

declare module 'next-intl' {
    interface AppConfig {
        Locale: Locale;
        Messages: AppMessages;
    }
}
