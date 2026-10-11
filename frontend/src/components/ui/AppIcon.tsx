import type {ReactNode} from 'react';

const drawings: Record<string, ReactNode> = {
    support: <><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/><path d="M19 19a3 3 0 0 1-3 3h-4"/></>,
    training: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/></>,
    community: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></>,
    kpi: <><path d="M4 20V10m5 10V5m5 15v-7m5 7V8M3 20h18"/></>,
    notes: <><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h6M9 16h6"/></>,
    cases: <><rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m8 14 3 3 5-6"/></>,
    materials: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4m-8 4v10"/></>,
    catalogs: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M12 8h4M12 12h4M12 16h3"/></>,
    colors: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.4A2 2 0 0 1 16 14h2a3 3 0 0 0 3-3 8 8 0 0 0-9-8Z"/><circle cx="7" cy="10" r=".7"/><circle cx="10" cy="7" r=".7"/><circle cx="14" cy="7" r=".7"/></>,
    roles: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    statuses: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8"/></>,
    directions: <><path d="M12 21V3m-5 5 5-5 5 5M12 16l-7-7M5 14V9h5M12 16l7-7M14 9h5v5"/></>,
    work: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h7"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
};
export type AppIconName = 'support'|'training'|'community'|'kpi'|'notes'|'cases'|'materials'|'catalogs'|'colors'|'roles'|'statuses'|'directions'|'work'|'arrow';

/** Same 24 px outline grid and rounded strokes as the original TeethTech interface. */
export default function AppIcon({name,className='h-5 w-5'}:{name:AppIconName;className?:string}) {
    return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>{drawings[name]}</svg>;
}
