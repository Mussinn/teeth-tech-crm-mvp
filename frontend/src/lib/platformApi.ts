export async function platformApi<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const multipart=body instanceof FormData;
 const response=await fetch('/api/platform/'+path,{method,credentials:'same-origin',headers:multipart?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:multipart?body:JSON.stringify(body)});
 const value=await response.json().catch(()=>({message:'Общая SaaS-платформа недоступна. Откройте CRM через адрес лаборатории.'}));
 if(!response.ok)throw new Error(value.message||'Не удалось выполнить запрос');return value as T;
}
export const supportStatuses:Record<string,string>={OPEN:'Новая',IN_PROGRESS:'В работе',WAITING:'Ждём ответа',RESOLVED:'Решена'};
export type SupportTicket={id:number;title:string;status:string;lab:string;page:string;updatedAt:string};
export type SupportDetail={ticket:SupportTicket;messages:Array<{id:number;author:string;owner:boolean;body:string;createdAt:string}>;files:Array<{id:number;name:string}>};
