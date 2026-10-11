export default function LaboratoryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <div className="mx-auto w-full max-w-[1600px] pb-8">{children}</div>;
}
