# Patch Notes: API Layer Updates

Date: 2026-07-13

## Коротко

В этом наборе изменений я добавил недостающие RTK Query hooks и типы под новые Swagger endpoints, а затем подключил безопасную часть этих hooks к существующим страницам и формам.

Основные зоны:

- сотрудники: удаление, обновление профиля, admin-setup, batch create;
- клиники: быстрый поиск `/clinics/search`;
- workflow: статусы, admin steps, order statuses;
- склад: нормы расхода `/nomenclature-norms`;
- материалы: получение материала по id;
- зарплаты: список сотрудников, история ведомостей, задачи ведомости, удаление черновика;
- заказы/задачи: ранее поправленные contracts для `/tasks`, employee kanban и order response.

Главное: файл ниже показывает, какой Swagger endpoint к какому frontend hook привязан и где лежат типы.

## Scope

This patch adds and corrects frontend RTK Query API endpoints and TypeScript contracts based on the Swagger screenshots provided.

It also wires the safe parts of those endpoints into existing UI pages where the response shapes match the current screens.

## UI Wiring Added

- `src/components/Modals/CreateOrderModal.tsx`
  - Clinic dropdown now uses `GET /clinics/search` through `useSearchClinicsQuery`.

- `src/app/(dashboard)/accounting/page.tsx`
  - Salary employee selects now use `GET /salaries/employees`.
  - Generated statement details can load tasks from `GET /salaries/statements/{id}/tasks`.
  - Draft statements can be deleted through `DELETE /salaries/statements/{id}`.
  - Statement history is shown from `GET /salaries/statements/history`.

- `src/components/warehouse/NomenclaturePanel.tsx`
  - Nomenclature card can create/update norms through `POST /nomenclature-norms`.
  - Norm deletion is available through `DELETE /nomenclature-norms/{id}` when a norm id is known.

- `src/app/(dashboard)/laboratory/workflows/page.tsx`
  - Added a server-backed workflow block using `GET /workflow/statuses`.
  - Admin workflow steps are listed, created, and deleted through `/admin/workflow/steps`.
  - Order statuses are listed, created, updated, and deleted through `/order-statuses`.
  - The previous local drag-and-drop workflow prototype remains below the server-backed block.

- `src/app/(dashboard)/employees/page.tsx`
  - Employee deletion is connected to `DELETE /users/{id}` with confirmation.

## Added API Endpoints

### Users and Staff

File: `src/services/api/usersApi.ts`

- `PATCH /users/{id}` -> `useUpdateUserMutation`
- `PATCH /users/{id}/admin-setup` -> `useUpdateUserAdminSetupMutation`
- `POST /users/batch` -> `useCreateUsersBatchMutation`
- `DELETE /users/{id}` -> `useDeleteUserMutation`

Types added in `src/types/user.types.ts`:

- `UpdateUserProfileRequest`
- `UpdateUserAdminSetupRequest`
- `BatchCreateUserItem`
- `BatchCreateUsersRequest`

Notes:

- `PATCH /users/{id}` and `PATCH /users/{id}/admin-setup` are typed as `void` responses because Swagger showed only `200 OK` without a response body.
- `POST /users/batch` returns `string[]` because Swagger response is an array of UUID strings.

### Clinics

File: `src/services/api/clinicsApi.ts`

- `GET /clinics/search` -> `useSearchClinicsQuery`

Types used:

- `ClinicSearchResponse`
- `ClinicSearchItem`
- `SearchClinicsParams`

Query params supported:

- `name`
- `page`
- `size`
- `sort`

### Workflow Statuses and Admin Workflow Steps

File: `src/services/api/workflowApi.ts`

- `GET /workflow/statuses` -> `useGetWorkflowStatusesQuery`
- `GET /admin/workflow/steps` -> `useGetAdminWorkflowStepsQuery`
- `POST /admin/workflow/steps` -> `useCreateAdminWorkflowStepMutation`
- `DELETE /admin/workflow/steps/{id}` -> `useDeleteAdminWorkflowStepMutation`

Types added in `src/types/workflow.types.ts`:

- `WorkflowStatus`
- `WorkflowStep`
- `GetWorkflowStepsArgs`
- `CreateWorkflowStepRequest`

Notes:

- `GET /admin/workflow/steps` requires `workTypeId` as query param.
- `DELETE /admin/workflow/steps/{id}` is typed as `void`.

### Order Statuses

File: `src/services/api/workflowApi.ts`

- `GET /order-statuses` -> `useGetOrderStatusesQuery`
- `POST /order-statuses` -> `useCreateOrderStatusMutation`
- `PUT /order-statuses/{id}` -> `useUpdateOrderStatusConfigMutation`
- `DELETE /order-statuses/{id}` -> `useDeleteOrderStatusMutation`

Types added in `src/types/workflow.types.ts`:

- `OrderStatus`
- `UpsertOrderStatusRequest`
- `UpdateOrderStatusArgs`

Cache tags added in `src/services/teethTechApi.ts`:

- `Workflow`
- `OrderStatuses`

### Materials

File: `src/services/api/laboratory/materialApi.ts`

- `GET /materials/{id}` -> `useGetMaterialQuery`

### Nomenclature Norms

File: `src/services/api/warehouseApi.ts`

- `POST /nomenclature-norms` -> `useUpsertNomenclatureNormMutation`
- `DELETE /nomenclature-norms/{id}` -> `useDeleteNomenclatureNormMutation`

Types added in `src/types/warehouse.types.ts`:

- `NomenclatureNormRequest`
- `NomenclatureNorm`

### Salaries

File: `src/services/api/salariesApi.ts`

- `GET /salaries/employees` -> `useGetSalaryEmployeesQuery`
- `DELETE /salaries/statements/{id}` -> `useDeleteSalaryStatementMutation`
- `GET /salaries/statements/{id}/tasks` -> `useGetSalaryStatementTasksQuery`
- `GET /salaries/statements/history` -> `useGetSalaryStatementsHistoryQuery`

Types added in `src/types/finance.types.ts`:

- `SalaryEmployee`
- `SalaryStatementsHistoryRequest`

Notes:

- `GET /salaries/statements/history` requires `start` and `end` query params.
- Existing salary endpoints remained unchanged:
  - `POST /salaries/config`
  - `GET /salaries/config/{userId}`
  - `POST /salaries/statements`
  - `POST /salaries/statements/{id}/confirm`

## Corrected Earlier API Contracts

These are corrections from the order/task API work done before this patch note.

File: `src/services/api/ordersApi.ts`

- `POST /tasks` is now a mutation, not a query.
- `POST /tasks` response is typed as `string` because Swagger returns a UUID string.
- `GET /tasks/kanban/my` was added.
- `GET /tasks/order/{orderId}/kanban/employee` was added.

Types added/corrected:

- `EmployeeKanbanResponse`
- `EmployeeKanbanColumn`
- `EmployeeKanbanTask`
- `GetOrderEmployeeKanbanArgs`

Important response shape:

```ts
{
  previousColumn: EmployeeKanbanColumn;
  currentColumn: EmployeeKanbanColumn;
  nextColumn: EmployeeKanbanColumn;
}
```

Order response/request corrections in `src/types/order.types.ts`:

- `OrderApiListItem` now includes `taskIds` and `clinic`.
- `CreateOrderTaskRequest` excludes file fields and excludes `discount`, matching the shown `POST /orders` request body.
- `orderId` inside `CreateOrderTaskRequest` is optional because the current new-order UI may not have an order id before creation.

## Validation

Commands run:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run lint
```

Result:

- TypeScript check passed.
- ESLint passed with existing warnings only.

Existing warnings are unrelated unused-variable warnings in:

- `src/app/(dashboard)/clinics/page.tsx`
- `src/app/(dashboard)/orders/[id]/page.tsx`
- `src/components/Modals/OrderTaskDetailModal.tsx`
- `src/services/api/clinicsApi.ts`

## Important Notes

- UI wiring was added only where the existing page already had a matching workflow.
- `PATCH /users/{id}`, `PATCH /users/{id}/admin-setup`, and `POST /users/batch` are still API-layer only; they need dedicated profile/admin/batch UI to avoid mixing permissions and bulk import into the employee table.
- `GET /materials/{id}` is API-layer only because the current materials list does not have a detail screen that needs it yet.
- No backend requests were executed manually.
- Endpoints were added only where request/response details were provided in the screenshots or messages.
- For endpoints where Swagger showed no JSON response body, the frontend mutation response is typed as `void`.
