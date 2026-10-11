interface SectionProps {
    style?: string,
    children: React.ReactNode
}


const Section = ({style, children}:SectionProps) => {
    return ( 
        <section
            className={`my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${style}`}
        >
            {children}
        </section> 
    );
}
 
export default Section;
