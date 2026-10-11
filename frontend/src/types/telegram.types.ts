export type TelegramLink = {
    url: string;
    expiresAt: string;
};

export type TelegramLinkStatus = {
    connected: boolean;
    enabled: boolean;
    chatIdMask?: string | null;
};

export type TelegramCommand = {
    command: string;
    description: string;
};

export type TelegramSettings = {
    enabled: boolean;
    tokenConfigured: boolean;
    tokenMask?: string | null;
    webhookSecretConfigured: boolean;
    webhookUrl?: string | null;
    botUsername?: string | null;
    commands: TelegramCommand[];
    updatedAt?: string | null;
    updatedBy?: string | null;
};

export type TelegramSettingsUpdate = {
    enabled: boolean;
    webhookUrl: string;
    commands: TelegramCommand[];
};

export type TelegramTokenUpdate = {
    token: string;
};
