import { compactMaterialNames } from '@/src/utils/materialAccounting';
import {useTranslations} from 'next-intl';

export default function MaterialChips({
    materialNames,
    compact = false,
    className = '',
}: {
    materialNames?: string[] | null;
    compact?: boolean;
    className?: string;
}) {
    const t = useTranslations('tasks.card');
    const names = compact ? compactMaterialNames(materialNames) : materialNames ?? [];

    if (names.length === 0) {
        return <span className="text-slate-400">{t('materialsMissing')}</span>;
    }

    return (
        <span className={`flex flex-wrap gap-1 ${className}`}>
            {names.map((name, index) => (
                <span
                    key={`${name}-${index}`}
                    className="inline-flex rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/20"
                >
                    {name}
                </span>
            ))}
        </span>
    );
}
