export type LabDetails = {
 modelSystem?:string; toothSet?:string; shadeSystem?:string;
 channel: string; family: string; prescription: string; appointment: string;
 implantSystem: string; implantPlatform: string; shadeNotes: string; incomingItems: string;
 batchReferences: string; shippingAddress: string; rush: boolean; designRequired: boolean; approvalGateStatusId: string;
};
export type LabState = {
 details: LabDetails; intake: string; acceptedAt?: string; onHold: boolean; holdReason: string;
 design: string; designApprovedBy: string; quality: string; qualityAt?: string; qualityBy: string;
 delivery: string; tracking: string; recipient: string; shippedAt?: string; deliveredAt?: string;
};
export type LabCase = {orderId:string; version:number; state:LabState; productionReady:boolean; openIncidents:boolean;
 events:Array<{id:string;action:string;actor:string;createdAt:string;details:{note?:string;reason?:string;checks?:Record<string,string>}}>};
export type LabAction = {orderId:string;version:number;action:string;details?:LabDetails;checks?:Record<string,string>;
 note?:string;clinician?:string;recipient?:string;tracking?:string;reason?:string};
export type LabQueueItem = {orderId:string;orderNumber:string;patient:string;clinic:string;deadline:string|null;
 appointment:string|null;rush:boolean;onHold:boolean;holdReason:string;intake:string;quality:string;delivery:string;productionReady:boolean};
