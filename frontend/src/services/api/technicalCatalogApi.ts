import {teethTechApi} from '@/src/services/teethTechApi';
export type TechnicalKind='implants'|'model-systems'|'tooth-sets'|'shade-systems';
export type TechnicalEntry={id:string;code:string;name:string;description:string;isActive:boolean};
export const technicalCatalogApi=teethTechApi.injectEndpoints({endpoints:builder=>({
 getTechnicalCatalog:builder.query<TechnicalEntry[],TechnicalKind>({query:kind=>`/${kind}`,providesTags:['Materials']}),
 saveTechnicalEntry:builder.mutation<TechnicalEntry,{kind:TechnicalKind;id?:string;body:Omit<TechnicalEntry,'id'>}>({query:({kind,id,body})=>({url:`/${kind}${id?'/'+encodeURIComponent(id):''}`,method:id?'PUT':'POST',body}),invalidatesTags:['Materials']}),
 deleteTechnicalEntry:builder.mutation<void,{kind:TechnicalKind;id:string}>({query:({kind,id})=>({url:`/${kind}/${encodeURIComponent(id)}`,method:'DELETE'}),invalidatesTags:['Materials']}),
})});
export const {useGetTechnicalCatalogQuery,useSaveTechnicalEntryMutation,useDeleteTechnicalEntryMutation}=technicalCatalogApi;
