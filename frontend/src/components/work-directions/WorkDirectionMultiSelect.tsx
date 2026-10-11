import type { WorkDirection } from '@/src/types/workDirection.types';

type WorkDirectionMultiSelectProps = {
    directions: WorkDirection[];
    value: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
    emptyText: string;
};

export default function WorkDirectionMultiSelect({
    directions,
    value,
    onChange,
    disabled = false,
    emptyText,
}: WorkDirectionMultiSelectProps) {
    if (directions.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">
                {emptyText}
            </p>
        );
    }

    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {directions.map((direction) => {
                const checked = value.includes(direction.id);

                return (
                    <label
                        key={direction.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            checked
                                ? 'border-violet-300 bg-violet-50/70'
                                : 'border-slate-200 bg-white hover:border-violet-200'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => onChange(
                                checked
                                    ? value.filter((id) => id !== direction.id)
                                    : [...value, direction.id]
                            )}
                            className="mt-0.5 h-4 w-4 accent-violet-600"
                        />
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">
                                {direction.name}
                            </span>
                            <span className="block truncate font-mono text-[10px] uppercase text-slate-400">
                                {direction.code}
                            </span>
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
