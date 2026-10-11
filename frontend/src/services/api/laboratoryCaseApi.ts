import {teethTechApi} from '@/src/services/teethTechApi';
import type {LabCase,LabAction,LabQueueItem} from '@/src/types/laboratoryCase.types';
export const laboratoryCaseApi=teethTechApi.injectEndpoints({endpoints:builder=>({
 getLaboratoryCase:builder.query<LabCase,string>({query:id=>`/orders/${encodeURIComponent(id)}/laboratory`,providesTags:['Orders','QualityIncidents']}),
 getLaboratoryQueue:builder.query<LabQueueItem[],{offset?:number;limit?:number;search?:string;phase?:string}|void>({query:args=>({url:'/laboratory/cases',params:args||{}}),providesTags:['Orders','QualityIncidents']}),
 laboratoryAction:builder.mutation<LabCase,LabAction>({query:({orderId,...body})=>({url:`/orders/${encodeURIComponent(orderId)}/laboratory/actions`,method:'POST',body}),invalidatesTags:(_r,error)=>error?[]:['Orders','OrderKanban','Tasks']}),
})});
export const {useGetLaboratoryCaseQuery,useGetLaboratoryQueueQuery,useLaboratoryActionMutation}=laboratoryCaseApi;
