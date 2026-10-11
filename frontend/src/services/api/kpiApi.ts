import {teethTechApi} from '@/src/services/teethTechApi';
export type Completion = {id:string;taskId:string;orderId:string;orderNumber:string;workName:string;quantity:number;employeeId:string;employeeName:string;closedByName:string;fromStatus:string;toStatus:string;terminal:boolean;completedAt:string};
export type KpiReport={employees:{employeeId:string;employeeName:string;completedTasks:number;completedStages:number;units:number}[];completions:Completion[];page:number;hasNext:boolean};
export const kpiApi=teethTechApi.injectEndpoints({endpoints:builder=>({getKpi:builder.query<KpiReport,{from:string;to:string;mine:boolean;page:number;employeeId?:string}>({query:({mine,...params})=>({url:mine?'/kpi/my':'/kpi',params}),keepUnusedDataFor:0})})});
export const {useGetKpiQuery}=kpiApi;
