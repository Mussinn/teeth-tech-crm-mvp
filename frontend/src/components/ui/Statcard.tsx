type StatCardProps = {
    title: string;
    value: string | number;
    trend?: string;
    isPositive?: boolean;
};

export const StatCard = ({title, value, trend, isPositive}: StatCardProps) => (
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="min-w-0 text-2xl font-bold text-slate-900 sm:text-3xl">{value}</span>
            {trend ?
                <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {trend}
                </span> :
                <></>
            }
        </div>
    </div>
);
