export type NomenclatureItem = {
    id: string;
    code: string;
    name: string;
    unit: string;
    minStockLevel: number;
    active: boolean;
    currentStock: number;
};

export type StockLevelStatus = 'SUFFICIENT' | 'LOW' | 'CRITICAL';

export type StockOverviewItem = {
    nomenclatureId: string;
    name: string;
    unit: string;
    currentQuantity: number;
    minStockLevel: number;
    statusCode: StockLevelStatus;
};

export type StockOverview = {
    totalPositionsCount: number;
    lowStockCount: number;
    items: StockOverviewItem[];
};

export type StockMovementType =
    | 'IN'
    | 'OUT'
    | 'ORDER_CONSUMPTION'
    | 'ORDER_RETURN'
    | 'INVENTORY_ADJUSTMENT';

export type StockMovement = {
    id: string;
    nomenclatureName: string;
    movementTypeCode: StockMovementType;
    quantity: number;
    reason: string;
    createdAt: string;
};

export type ReceiveStockRequest = {
    quantity: number;
    reason: string;
};

export type InventoryCheckStatus =
    | 'DRAFT'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | (string & {});

export type InventoryStatusRule = {
    code: InventoryCheckStatus;
    name: string;
    initial: boolean;
    locksWarehouse: boolean;
    allowsCounting: boolean;
    marksCompleted: boolean;
    marksCancelled: boolean;
    terminal: boolean;
    active: boolean;
};

export type InventoryCheckItem = {
    id: string;
    nomenclatureId: string;
    nomenclatureName: string;
    unit: string;
    expectedQuantity: number;
    actualQuantity: number | null;
    discrepancy: number;
};

export type InventoryCheckItemsPage = {
    content: InventoryCheckItem[];
    number: number;
    size: number;
    numberOfElements: number;
    first: boolean;
    last: boolean;
    totalPages?: number;
    totalElements?: number;
};

export type InventoryCheck = {
    id: string;
    statusCode: InventoryCheckStatus;
    startedAt: string | null;
    completedAt: string | null;
    createdByUserId: string;
    comment: string;
    items: InventoryCheckItem[];
};

export type CreateInventoryCheckRequest = {
    comment: string;
};

export type UpdateInventoryItemRequest = {
    actualQuantity: number;
};

export type NomenclatureNormRequest = {
    workTypeId: string;
    materialId: string;
    nomenclatureId: string;
    normQuantity: number;
};

export type NomenclatureNorm = NomenclatureNormRequest & {
    id: string;
    createdAt: string;
    updatedAt: string;
};

export type ProcurementSupplier = {
    id: string;
    name: string;
    bin: string;
    phone: string;
    email: string;
    active: boolean;
};

export type CreateProcurementSupplierRequest = {
    name: string;
    bin: string;
    phone: string;
    email: string;
    active: boolean;
};

export type UpdateProcurementSupplierRequest = {
    name: string;
    bin: string;
    phone: string;
    email: string;
    active: boolean;
};

export type ProcurementOrderItem = {
    id: string;
    nomenclatureId: string;
    name: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
    receivedAmount: number;
};

export type ProcurementOrder = {
    id: string;
    number: string;
    supplierId: string;
    supplierName: string;
    status: string;
    expectedAt: string | null;
    receivedAt: string | null;
    totalAmount: number;
    receivedAmount: number;
    items: ProcurementOrderItem[];
};

export type ProcurementOrdersPage = {
    content: ProcurementOrder[];
    number: number;
    size: number;
    numberOfElements: number;
    totalPages: number;
    totalElements: number;
    first: boolean;
    last: boolean;
    empty: boolean;
};

export type ProcurementOrdersQueryParams = {
    page?: number;
    size?: number;
    sort?: string | string[];
};

export type CreateProcurementOrderRequest = {
    supplierId: string;
    expectedAt?: string;
    items: Array<{
        nomenclatureId: string;
        quantity: number;
        unitPrice: number;
    }>;
};

export type ReceiveProcurementOrderRequest = {
    receiptId: string;
    items: Array<{
        itemId: string;
        quantity: number;
        lotNumber: string;
        expiresAt?: string;
    }>;
};
