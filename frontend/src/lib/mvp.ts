export const mvpModules = { chat: false, integrations: false, warehouse: process.env.NEXT_PUBLIC_MVP_WAREHOUSE_ENABLED === 'true', finance: process.env.NEXT_PUBLIC_MVP_FINANCE_ENABLED === 'true' };
export function isMvpRouteEnabled(path: string) {
 const within = (prefix: string) => path === prefix || path.startsWith(prefix + '/');
 return (mvpModules.chat || !within('/chats')) && (mvpModules.integrations || !within('/settings/integrations')) && (mvpModules.warehouse || !within('/warehouse')) && (mvpModules.finance || !['/accounting','/documents'].some(within));
}
