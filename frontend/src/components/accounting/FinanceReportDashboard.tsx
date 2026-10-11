'use client';

import { useState } from 'react';

import type {
    FinanceOrderLine,
    FinanceReport,
    FinanceSalaryLine,
    FinanceWarehouseLine,
} from '@/src/types/finance.types';
import {useTranslations} from 'next-intl';
import {useAppFormatters} from '@/src/i18n/provider';

type ReportTab = 'orders' | 'salary' | 'warehouse' | 'payments';

const reportTabs: ReportTab[] = ['orders', 'salary', 'warehouse', 'payments'];

function ValueCard({
    label,
    value,
    note,
    tone = 'slate',
}: {
    label: string;
    value: string;
    note?: string;
    tone?: 'slate' | 'emerald' | 'amber' | 'violet' | 'blue' | 'rose';
}) {
    const tones = {
        slate: 'border-l-slate-400',
        emerald: 'border-l-emerald-500',
        amber: 'border-l-amber-500',
        violet: 'border-l-violet-500',
        blue: 'border-l-blue-500',
        rose: 'border-l-rose-500',
    };
    return (
        <article className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${tones[tone]}`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{value}</p>
            {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
        </article>
    );
}

function Totals({ items }: { items: Array<{ label: string; value: string; tone?: string }> }) {
    return (
        <dl className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 ${item.tone ?? ''}`}>
                    <dt className="text-[9px] font-black uppercase tracking-wide text-slate-400">{item.label}</dt>
                    <dd className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

function EmptyState({ text }: { text?: string }) {
    const t = useTranslations('accounting.report');
    return <p className="p-10 text-center text-sm font-semibold text-slate-400">{text ?? t('empty')}</p>;
}

function TableShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="max-h-[620px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            {children}
        </div>
    );
}

const th = 'sticky top-0 z-10 whitespace-nowrap bg-slate-100 px-3 py-3 text-left text-[9px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800';
const td = 'whitespace-nowrap border-t border-slate-100 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300';

function OrdersTable({ lines }: { lines: FinanceOrderLine[] }) {
    const t = useTranslations('accounting.report.tables.orders');
    const {currency: money, number, dateTime} = useAppFormatters();
    const headers = ['order', 'clinic', 'patient', 'work', 'technician', 'quantity', 'unitPrice', 'gross', 'discountPercent', 'discount', 'workAmount', 'earnings', 'payroll', 'completed'] as const;
    if (!lines.length) return <EmptyState />;
    return (
        <TableShell>
            <table className="min-w-[1900px] w-full">
                <thead><tr>
                    {headers.map((key) => <th key={key} className={th}>{t(key)}</th>)}
                </tr></thead>
                <tbody>{lines.map((line, index) => (
                    <tr key={`${line.orderNumber}-${line.completedAt}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className={`${td} font-black`}>{line.orderNumber || '—'}</td>
                        <td className={td}>{line.clinicName || '—'}</td><td className={td}>{line.patientName || '—'}</td>
                        <td className={td}>{line.workType || '—'}</td><td className={td}>{line.technicianName || '—'}</td>
                        <td className={td}>{number(line.quantity, {maximumFractionDigits: 4})}</td><td className={td}>{money(line.pricePerUnit)}</td>
                        <td className={td}>{money(line.grossAmount)}</td><td className={td}>{number(line.discountPercent, {maximumFractionDigits: 2})} %</td>
                        <td className={td}>{money(line.discountAmount)}</td><td className={`${td} font-black`}>{money(line.netAmount)}</td>
                        <td className={td}>{money(line.salaryEarnedAmount)}</td><td className={td}>{line.salaryStatementId || '—'}</td>
                        <td className={td}>{line.completedAt ? dateTime(line.completedAt, {dateStyle: 'short', timeStyle: 'short'}) : '—'}</td>
                    </tr>
                ))}</tbody>
            </table>
        </TableShell>
    );
}

function SalaryTable({ lines }: { lines: FinanceSalaryLine[] }) {
    const t = useTranslations('accounting.report');
    const {currency: money, number, date, dateTime} = useAppFormatters();
    const headers = ['employee', 'start', 'end', 'paymentType', 'status', 'baseSalary', 'piecework', 'accrued', 'carryIn', 'carryOut', 'payable', 'tasks', 'paid'] as const;
    if (!lines.length) return <EmptyState />;
    return (
        <TableShell>
            <table className="min-w-[1750px] w-full">
                <thead><tr>
                    {headers.map((key) => <th key={key} className={th}>{t(`tables.salary.${key}`)}</th>)}
                </tr></thead>
                <tbody>{lines.map((line, index) => (
                    <tr key={`${line.employeeName}-${line.startDate}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className={`${td} font-black`}>{line.employeeName || '—'}</td><td className={td}>{line.startDate ? date(line.startDate, {dateStyle: 'short'}) : '—'}</td>
                        <td className={td}>{line.endDate ? date(line.endDate, {dateStyle: 'short'}) : '—'}</td><td className={td}>{['FIXED', 'PIECEWORK', 'HYBRID'].includes(line.paymentType) ? t(`paymentTypes.${line.paymentType as 'FIXED' | 'PIECEWORK' | 'HYBRID'}`) : line.paymentType}</td>
                        <td className={td}><span className={`rounded-full px-2 py-1 font-bold ${line.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{['DRAFT', 'PAID'].includes(line.status) ? t(`salaryStatuses.${line.status as 'DRAFT' | 'PAID'}`) : line.status}</span></td>
                        <td className={td}>{money(line.baseSalaryAmount)}</td><td className={td}>{money(line.pieceworkAmount)}</td>
                        <td className={td}>{money(line.grossAccruedAmount)}</td><td className={td}>{money(line.carryInAmount)}</td>
                        <td className={td}>{money(line.carryOutAmount)}</td><td className={`${td} font-black`}>{money(line.totalAmount)}</td>
                        <td className={td}>{number(line.totalTasksCount, {maximumFractionDigits: 4})}</td><td className={td}>{line.paidAt ? dateTime(line.paidAt, {dateStyle: 'short', timeStyle: 'short'}) : '—'}</td>
                    </tr>
                ))}</tbody>
            </table>
        </TableShell>
    );
}

function isPurchase(line: FinanceWarehouseLine) {
    const marker = `${line.movementType} ${line.referenceType}`.toUpperCase();
    return marker.includes('PURCHASE') || marker.includes('RECEIPT') || marker.includes('INCOME');
}

function WarehouseTable({ lines, purchase }: { lines: FinanceWarehouseLine[]; purchase: boolean }) {
    const t = useTranslations('accounting.report');
    const {currency: money, number, dateTime} = useAppFormatters();
    const headers = ['date', 'movement', 'referenceType', 'referenceId', 'item', 'unit', 'quantity', 'standard', 'waste', 'totalCost', 'standardCost', 'wasteCost', 'reason'] as const;
    const filtered = lines.filter((line) => isPurchase(line) === purchase);
    if (!filtered.length) return <EmptyState text={purchase ? t('emptyReceipts') : t('emptyWriteOffs')} />;
    return (
        <TableShell>
            <table className="min-w-[1900px] w-full">
                <thead><tr>
                    {headers.map((key) => <th key={key} className={th}>{t(`tables.warehouse.${key}`)}</th>)}
                </tr></thead>
                <tbody>{filtered.map((line, index) => (
                    <tr key={`${line.referenceId}-${line.nomenclatureName}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className={td}>{line.createdAt ? dateTime(line.createdAt, {dateStyle: 'short', timeStyle: 'short'}) : '—'}</td><td className={`${td} font-bold`}>{line.movementType || '—'}</td>
                        <td className={td}>{line.referenceType || '—'}</td><td className={td}>{line.referenceId || '—'}</td>
                        <td className={`${td} font-black`}>{line.nomenclatureName || '—'}</td><td className={td}>{line.unit || '—'}</td>
                        <td className={td}>{number(line.quantity, {maximumFractionDigits: 4})}</td><td className={td}>{number(line.standardQuantity, {maximumFractionDigits: 4})}</td>
                        <td className={td}>{number(line.wasteQuantity, {maximumFractionDigits: 4})}</td><td className={`${td} font-black`}>{money(line.totalCost)}</td>
                        <td className={td}>{money(line.standardCost)}</td><td className={td}>{money(line.wasteCost)}</td>
                        <td className={`${td} max-w-64 whitespace-normal`}>{line.reason || '—'}</td>
                    </tr>
                ))}</tbody>
            </table>
        </TableShell>
    );
}

export default function FinanceReportDashboard({
    report,
    isLoading,
}: {
    report: FinanceReport;
    isLoading: boolean;
}) {
    const t = useTranslations('accounting.report');
    const {currency: money, number, dateTime} = useAppFormatters();
    const percent = (value?: number | null) => `${number(value ?? 0, {maximumFractionDigits: 2})} %`;
    const [activeTab, setActiveTab] = useState<ReportTab>('orders');
    const order = report.orderAccounting;
    const salary = report.salaryAccounting;
    const warehouse = report.warehouseAccounting;
    const payments = report.paymentAccounting;
    const reconciliation = report.reconciliation;
    const cards = [
        [t('cards.grossRevenue'), money(report.grossRevenue), t('cards.beforeDiscounts'), 'emerald'],
        [t('cards.discounts'), money(report.totalDiscounts), t('cards.discountsNote'), 'amber'],
        [t('cards.completedWork'), money(order?.netWorkAmount ?? 0), t('taskCount', {count: order?.completedTaskCount ?? report.totalCompletedTasks}), 'blue'],
        [t('cards.receivedPayments'), money(report.netRevenue), t('paymentCount', {count: payments?.paymentCount ?? 0}), 'emerald'],
        [t('cards.payroll'), money(report.totalPayroll), t('cards.periodExpense'), 'violet'],
        [t('cards.materialCost'), money(report.materialCost ?? 0), t('cards.usedInProduction'), 'rose'],
        [t('cards.purchases'), money(report.inventoryPurchases ?? 0), t('cards.purchasesNote'), 'blue'],
        [t('cards.profit'), money(report.grossProfit), t('cards.profitNote'), report.grossProfit >= 0 ? 'emerald' : 'rose'],
        [t('cards.margin'), percent(report.marginPercentage), t('cards.marginNote'), report.marginPercentage >= 0 ? 'emerald' : 'rose'],
    ] as const;

    if (isLoading) {
        return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-500">{t('loading')}</div>;
    }

    return (
        <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {cards.map(([label, value, note, tone]) => <ValueCard key={label} label={label} value={value} note={note} tone={tone} />)}
            </section>

            {reconciliation ? (
                <section className={`rounded-2xl border p-5 ${reconciliation.balanced ? 'border-emerald-300 bg-emerald-50/70' : 'border-red-300 bg-red-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{t('reconciliation.eyebrow')}</p><h2 className={`mt-1 text-lg font-black ${reconciliation.balanced ? 'text-emerald-800' : 'text-red-800'}`}>{reconciliation.balanced ? t('reconciliation.passed') : t('reconciliation.mismatch')}</h2></div>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${reconciliation.balanced ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{reconciliation.balanced ? t('reconciliation.balanced') : t('reconciliation.review')}</span>
                    </div>
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            [t('reconciliation.workMinusPayments'), money(reconciliation.netWorkMinusPayments)],
                            [t('reconciliation.materialDifference'), money(reconciliation.materialCostDifference)],
                            [t('reconciliation.payrollDifference'), money(reconciliation.payrollDifference)],
                            [t('reconciliation.tasksWithoutPayroll'), number(reconciliation.completedTasksWithoutSalaryStatement)],
                            [t('reconciliation.tasksWithoutWriteOff'), number(reconciliation.completedTasksWithoutMaterialWriteOff)],
                            [t('reconciliation.writeOffsWithoutTask'), number(reconciliation.stockWriteOffsWithoutCompletedTask)],
                            [t('reconciliation.paymentsWithoutOrder'), number(reconciliation.paymentsWithoutOrder)],
                        ].map(([label, value]) => <div key={label} className="rounded-xl bg-white/80 px-3 py-2"><dt className="text-[9px] font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-black text-slate-800">{value}</dd></div>)}
                    </dl>
                    {!reconciliation.balanced && reconciliation.warnings.length ? (
                        <ul className="mt-4 space-y-2">{reconciliation.warnings.map((warning, index) => <li key={`${warning}-${index}`} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">⚠ {warning}</li>)}</ul>
                    ) : null}
                </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
                    {reportTabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black ${activeTab === tab ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{t(`tabs.${tab}`)}</button>)}
                </div>

                {activeTab === 'orders' ? <><Totals items={[
                    { label: t('totals.completedTasks'), value: number(order?.completedTaskCount ?? 0) },
                    { label: t('totals.grossAmount'), value: money(order?.grossAmount ?? 0) },
                    { label: t('totals.discounts'), value: money(order?.discountAmount ?? 0) },
                    { label: t('totals.completedWorkAmount'), value: money(order?.netWorkAmount ?? 0) },
                ]} /><OrdersTable lines={order?.lines ?? []} /></> : null}

                {activeTab === 'salary' ? <><Totals items={[
                    { label: t('totals.statements'), value: number(salary?.statementCount ?? 0) },
                    { label: t('totals.paidTasks'), value: number(salary?.paidTaskCount ?? 0) },
                    { label: t('totals.baseSalary'), value: money(salary?.baseSalaryAmount ?? 0) },
                    { label: t('totals.piecework'), value: money(salary?.pieceworkAmount ?? 0) },
                    { label: t('totals.accrued'), value: money(salary?.grossAccruedAmount ?? 0) },
                    { label: t('totals.carryIn'), value: money(salary?.carryInAmount ?? 0) },
                    { label: t('totals.carryOut'), value: money(salary?.carryOutAmount ?? 0) },
                    { label: t('totals.paid'), value: money(salary?.totalPaidAmount ?? 0) },
                ]} /><SalaryTable lines={salary?.lines ?? []} /></> : null}

                {activeTab === 'warehouse' ? <div className="space-y-6"><Totals items={[
                    { label: t('totals.writeOffs'), value: number(warehouse?.materialWriteOffCount ?? 0) },
                    { label: t('totals.writeOffCost'), value: money(warehouse?.materialWriteOffCost ?? 0) },
                    { label: t('totals.standardCost'), value: money(warehouse?.materialStandardCost ?? 0) },
                    { label: t('totals.wasteCost'), value: money(warehouse?.materialWasteCost ?? 0) },
                    { label: t('totals.writtenOffQuantity'), value: number(warehouse?.materialWriteOffQuantity ?? 0) },
                    { label: t('totals.purchaseReceipts'), value: number(warehouse?.purchaseReceiptCount ?? 0) },
                    { label: t('totals.purchaseCost'), value: money(warehouse?.purchaseReceiptCost ?? 0), tone: 'text-blue-700' },
                ]} /><div><h3 className="mb-2 text-sm font-black text-rose-700">{t('sections.productionWriteOffs')}</h3><WarehouseTable lines={warehouse?.lines ?? []} purchase={false} /></div><div><h3 className="mb-2 text-sm font-black text-blue-700">{t('sections.purchaseReceipts')}</h3><WarehouseTable lines={warehouse?.lines ?? []} purchase /></div></div> : null}

                {activeTab === 'payments' ? <><Totals items={[
                    { label: t('totals.paymentCount'), value: number(payments?.paymentCount ?? 0) },
                    { label: t('totals.received'), value: money(payments?.receivedAmount ?? 0) },
                ]} />{payments?.lines.length ? <TableShell><table className="min-w-[1100px] w-full"><thead><tr>{(['paidAt', 'invoice', 'order', 'clinic', 'amount', 'method', 'reference'] as const).map((key) => <th key={key} className={th}>{t(`tables.payments.${key}`)}</th>)}</tr></thead><tbody>{payments.lines.map((line, index) => <tr key={`${line.invoiceNumber}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60"><td className={td}>{line.paidAt ? dateTime(line.paidAt, {dateStyle: 'short', timeStyle: 'short'}) : '—'}</td><td className={`${td} font-black`}>{line.invoiceNumber || '—'}</td><td className={td}>{line.orderNumber || '—'}</td><td className={td}>{line.clinicName || '—'}</td><td className={`${td} font-black`}>{money(line.amount)}</td><td className={td}>{line.paymentMethod || '—'}</td><td className={td}>{line.externalReference || '—'}</td></tr>)}</tbody></table></TableShell> : <EmptyState />}</> : null}
            </section>
        </div>
    );
}
