// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const backend = process.env.GO_AUTH_TEST_BACKEND_URL;
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test.skipIf(!backend)('existing Next.js proxy supports workflow templates, transitions and order autocomplete', async () => {
    vi.stubEnv('BACKEND_API_BASE_URL', backend!);
    vi.resetModules();
    const proxy = await import('@/src/app/api/backend/[...path]/route');
    const login = await proxy.POST(new NextRequest('http://localhost:3000/api/backend/auth/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'admin@teethtech.kz', password: 'adminTeethtech' }),
    }), { params: Promise.resolve({ path: ['auth', 'sessions'] }) });
    expect(login.status).toBe(200);
    const actor = await login.json();
    const cookies = login.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const call = async (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string[], body?: unknown, query = '') =>
        proxy[method](new NextRequest(`http://localhost:3000/api/backend/${path.map(encodeURIComponent).join('/')}${query}`, {
            method, headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', cookie: cookies },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }), { params: Promise.resolve({ path }) });
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
    const stockResponse = await call('POST', ['nomenclature'], {
        code: ` WEB_STOCK_${suffix} `, name: '  Складская позиция  ', unit: ' г ', minStockLevel: 1.2345,
    });
    expect(stockResponse.status).toBe(201);
    const stockItem = await stockResponse.json();
    expect(stockItem).toMatchObject({ code: `WEB_STOCK_${suffix}`, name: 'Складская позиция', unit: 'г',
        minStockLevel: 1.2345, active: true, currentStock: 0 });
    const stockCard = await call('GET', ['nomenclature', stockItem.id]);
    expect(stockCard.status).toBe(200);
    expect(await stockCard.json()).toEqual(stockItem);
    const stockPage = await call('GET', ['nomenclature'], undefined, '?activeOnly=true&size=100&sort=createdAt,desc');
    expect(stockPage.status).toBe(200);
    expect(await stockPage.json()).toMatchObject({ content: expect.arrayContaining([stockItem]), size: 100, last: expect.any(Boolean) });

    const balanceResponse = await call('GET', ['stock', stockItem.id, 'balance']);
    expect(balanceResponse.status).toBe(200);
    expect(await balanceResponse.json()).toBe(0);
    const overviewResponse = await call('GET', ['stock', 'overview']);
    expect(overviewResponse.status).toBe(200);
    const overview = await overviewResponse.json();
    expect(overview).toMatchObject({ totalPositionsCount: expect.any(Number), lowStockCount: expect.any(Number),
        items: expect.arrayContaining([expect.objectContaining({ nomenclatureId: stockItem.id, name: stockItem.name,
            currentQuantity: 0, minStockLevel: 1.2345, statusCode: expect.any(String) })]) });
    expect(overview.items).toHaveLength(overview.totalPositionsCount);
    const movementResponse = await call('GET', ['stock', 'movements', 'recent'], undefined, '?limit=3');
    expect(movementResponse.status).toBe(200);
    const movements = await movementResponse.json();
    expect(Array.isArray(movements)).toBe(true);
    expect(movements.length).toBeLessThanOrEqual(3);

    const auditResponse = await call('GET', ['admin', 'audit'], undefined, '?size=2');
    expect(auditResponse.status).toBe(200);
    expect(await auditResponse.json()).toMatchObject({ content: expect.any(Array), size: 2, totalElements: expect.any(Number) });
    const deadLetters = await call('GET', ['admin', 'outbox', 'dead-letters']);
    expect(deadLetters.status).toBe(200);
    const deadPage = await deadLetters.json();
    expect(deadPage.content).toEqual(expect.arrayContaining([expect.objectContaining({ id: process.env.GO_ADMIN_TEST_OUTBOX_ID, status: 'DEAD_LETTER' })]));
    expect(deadPage.content[0]).not.toHaveProperty('payload');
    const retried = await call('POST', ['admin', 'outbox', process.env.GO_ADMIN_TEST_OUTBOX_ID!, 'retry']);
    expect(retried.status).toBe(204);
    expect(await retried.text()).toBe('');
    const afterRetry = await call('GET', ['admin', 'outbox', 'dead-letters']);
    expect(afterRetry.status).toBe(200);
    expect((await afterRetry.json()).content).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: process.env.GO_ADMIN_TEST_OUTBOX_ID })]));

    const preferences = await call('GET', ['notifications', 'preferences']);
    expect(preferences.status).toBe(200);
    const currentPreferences = await preferences.json();
    expect(currentPreferences).toMatchObject({ inAppEnabled: expect.any(Boolean), taskAssigned: expect.any(Boolean) });
    const savedPreferences = await call('PUT', ['notifications', 'preferences'], currentPreferences);
    expect(savedPreferences.status).toBe(200);
    expect(await savedPreferences.json()).toEqual(currentPreferences);
    const notifications = await call('GET', ['notifications'], undefined, '?size=30');
    expect(notifications.status).toBe(200);
    const notificationPage = await notifications.json();
    expect(notificationPage).toMatchObject({ content: expect.any(Array), size: 30, totalElements: expect.any(Number) });
    const unread = await call('GET', ['notifications', 'unread-count']);
    expect(unread.status).toBe(200);
    expect(await unread.json()).toMatchObject({ count: expect.any(Number) });

    const noteResponse = await call('POST', ['personal-notes'], { title: '  Frontend note  ', content: '  Remember  ' });
    expect(noteResponse.status).toBe(201);
    const note = await noteResponse.json();
    expect(note).toMatchObject({ title: 'Frontend note', content: 'Remember', createdAt: expect.any(String), updatedAt: expect.any(String), expiresAt: expect.any(String) });
    const notes = await call('GET', ['personal-notes'], undefined, '?q=Frontend%20note&size=20');
    expect(notes.status).toBe(200);
    expect(await notes.json()).toMatchObject({ content: expect.arrayContaining([note]), size: 20 });
    const editedNote = await call('PUT', ['personal-notes', note.id], { title: 'Changed note' });
    expect(editedNote.status).toBe(200);
    expect(await editedNote.json()).toMatchObject({ id: note.id, title: 'Changed note', content: null });
    const deletedNote = await call('DELETE', ['personal-notes', note.id]);
    expect(deletedNote.status).toBe(204);
    expect(await deletedNote.text()).toBe('');

    const created = await call('POST', ['admin', 'workflow', 'work-types'], {
        workTypeCode: `web_workflow_${suffix}`, workTypeName: `Web workflow ${suffix}`,
        stages: [{ code: `web_stage_${suffix}`, name: `Web stage ${suffix}`, requiredRole: 'ADMIN', materialReportRequired: true }],
    });
    expect(created.status).toBe(201);
    const workflow = await created.json();
    expect(workflow.steps).toHaveLength(3);
    const normInput = { workTypeId: workflow.workTypeId,
        materialId: JSON.parse(process.env.GO_CREATE_TEST_TASK!).materialIds[0],
        nomenclatureId: stockItem.id, normQuantity: 1.2345 };
    const normResponse = await call('POST', ['nomenclature-norms'], normInput);
    expect(normResponse.status).toBe(201);
    const norm = await normResponse.json();
    expect(norm).toMatchObject({ ...normInput, id: expect.any(String), wastePercent: 0,
        createdAt: expect.any(String), updatedAt: expect.any(String) });
    const normUpdate = await call('POST', ['nomenclature-norms'], { ...normInput, normQuantity: 2, wastePercent: 12.34 });
    expect(normUpdate.status).toBe(201);
    expect(await normUpdate.json()).toMatchObject({ id: norm.id, createdAt: norm.createdAt, normQuantity: 2, wastePercent: 12.34 });
    const normDelete = await call('DELETE', ['nomenclature-norms', norm.id]);
    expect(normDelete.status).toBe(204);
    expect(await normDelete.text()).toBe('');

    const slaResponse = await call('POST', ['admin', 'sla-rules'], {
        workTypeId: workflow.workTypeId, statusId: workflow.steps[0].toStatusId,
        warningMinutes: 10, breachMinutes: 20, escalationRole: 'ROLE_ADMIN', active: false,
    });
    expect(slaResponse.status).toBe(200);
    const sla = await slaResponse.json();
    const slaUpdated = await call('PUT', ['admin', 'sla-rules', sla.id], {
        warningMinutes: 30, breachMinutes: 60, active: false,
    });
    expect(slaUpdated.status).toBe(200);
    const slaRule = await slaUpdated.json();
    expect(slaRule).toEqual({ id: sla.id, workTypeId: null, statusId: null,
        warningMinutes: 30, breachMinutes: 60, escalationRole: null, active: false });
    const slaList = await call('GET', ['admin', 'sla-rules']);
    expect(slaList.status).toBe(200);
    expect(await slaList.json()).toEqual(expect.arrayContaining([slaRule]));

    expect(workflow.steps[0]).toMatchObject({ fromStatusCode: 'TODO', requiredRole: 'ROLE_ADMIN', materialReportRequired: false });
    expect(workflow.steps[1]).toMatchObject({ toStatusCode: 'WAITING_FOR_APPROVAL', materialReportRequired: true });
    expect(workflow.steps[2]).toMatchObject({ toStatusCode: 'ORDER_CLOSED', requiredRole: 'ROLE_DISPATCHER' });
    const steps = await call('GET', ['admin', 'workflow', 'steps'], undefined, `?workTypeId=${workflow.workTypeId}`);
    expect(steps.status).toBe(200);
    expect(await steps.json()).toEqual(workflow.steps);
    for (const prefix of ['tasks', 'order-tasks']) {
        const assignable = await call('GET', [prefix, 'work-types', workflow.workTypeId, 'assignable-statuses']);
        expect(assignable.status).toBe(200);
        const statuses = await assignable.json();
        expect(statuses).toHaveLength(2);
        expect(statuses[0]).toMatchObject({ statusId: workflow.steps[1].fromStatusId, requiredRole: 'ROLE_ADMIN', eligibleAssignees: expect.any(Array) });
        expect(statuses[1]).toMatchObject({ statusCode: 'WAITING_FOR_APPROVAL', requiredRole: 'ROLE_DISPATCHER' });
        expect(statuses[0].eligibleAssignees.length).toBeGreaterThan(0);
        expect(statuses[0].eligibleAssignees[0]).toMatchObject({ userId: expect.any(String), activeTaskCount: expect.any(Number), isCurrent: false });
    }
    for (const key of [workflow.workTypeCode, workflow.workTypeName]) {
        const transitions = await call('GET', ['workflow', key, 'available-transitions', workflow.steps[0].fromStatusId]);
        expect(transitions.status).toBe(200);
        expect(await transitions.json()).toEqual([expect.objectContaining({ id: workflow.steps[0].toStatusId, initial: false, terminal: false })]);
    }
    const options = await call('GET', ['orders', 'form-options', 'work-types'], undefined, `?q=${suffix}&limit=1`);
    expect(options.status).toBe(200);
    expect(await options.json()).toMatchObject({ content: [{ id: workflow.workTypeId, label: workflow.workTypeName, code: workflow.workTypeCode }], size: 1, last: true });
    const clinicResponse = await call('POST', ['clinics'], { name: `Workflow clinic ${suffix}` });
    expect(clinicResponse.status).toBe(201);
    const clinicId = await clinicResponse.json();
    const people = await call('GET', ['orders', 'form-options', 'people'], undefined, `?clinicId=${clinicId}&role=PATIENT&limit=20`);
    expect(people.status).toBe(200);
    expect(await people.json()).toMatchObject({ content: [], empty: true, size: 20 });
    const orderResponse = await call('POST', ['orders'], {
        clinicId, patientFullName: 'Web patient', doctorFullName: 'Web doctor', deadline: '2030-01-01',
        tasks: [{ ...JSON.parse(process.env.GO_CREATE_TEST_TASK!), workTypeId: workflow.workTypeId,
            quantity: 2, pricePerUnit: 12.5, discountPercent: 10, toothNumbers: [11, 12] }],
    });
    expect(orderResponse.status).toBe(201);
    const order = await orderResponse.json();
    expect(order).toMatchObject({ patientFullName: 'Web patient', totalPrice: 22.5, taskIds: [expect.any(String)] });
    const materialPlan = await call('GET', ['tasks', order.taskIds[0], 'material-plan']);
    expect(materialPlan.status).toBe(200);
    expect(await materialPlan.json()).toHaveLength(1);
    const addedTask = await call('POST', ['tasks'], {
        ...JSON.parse(process.env.GO_CREATE_TEST_TASK!), orderId: order.id, workTypeId: workflow.workTypeId,
        quantity: 1, pricePerUnit: 5, discountPercent: 0, toothNumbers: [21],
    });
    expect(addedTask.status).toBe(201);
    const addedId = await addedTask.json();
    expect(addedId).toMatch(/^[0-9a-f-]{36}$/);
    const addedPlan = await call('GET', ['order-tasks', addedId, 'material-plan']);
    expect(addedPlan.status).toBe(200);
    expect(await addedPlan.json()).toHaveLength(1);
    const edited = await call('PATCH', ['order-tasks', addedId], { quantity: 2, pricePerUnit: 7, discountPercent: 10 });
    expect(edited.status).toBe(204);
    expect((await call('GET', ['tasks', addedId, 'material-plan'])).status).toBe(200);
    expect((await call('PATCH', ['tasks', addedId, 'materials'], { materialIds: JSON.parse(process.env.GO_CREATE_TEST_TASK!).materialIds })).status).toBe(204);
    expect((await call('DELETE', ['tasks', addedId])).status).toBe(204);
    expect((await call('GET', ['tasks', addedId, 'material-plan'])).status).toBe(404);
    const updatedOrder = await call('PATCH', ['orders', order.id], { deadline: '2031-02-03', comment: 'Updated from frontend' });
    expect(updatedOrder.status).toBe(200);
    expect(await updatedOrder.json()).toMatchObject({ id: order.id, patientFullName: 'Web patient' });
    const boardResponse = await call('GET', ['orders', order.id, 'kanban']);
    expect(boardResponse.status).toBe(200);
    expect(await boardResponse.json()).toEqual(expect.arrayContaining([expect.objectContaining({ statusName: 'ORDER_CLOSED', tasks: expect.any(Array) })]));
    for (const prefix of ['tasks', 'order-tasks']) {
        const employeeResponse = await call('GET', [prefix, 'order', order.id, 'kanban', 'employee']);
        expect(employeeResponse.status).toBe(200);
        expect(await employeeResponse.json()).toMatchObject({
            previousColumn: { statusName: 'PREVIOUS', tasks: [] },
            currentColumn: { statusName: 'CURRENT', taskCount: 1, tasks: [expect.objectContaining({ id: order.taskIds[0] })] },
            nextColumn: { statusName: 'NEXT', tasks: [] },
        });
        const myResponse = await call('GET', [prefix, 'kanban', 'my']);
        expect(myResponse.status).toBe(200);
        expect(await myResponse.json()).toMatchObject({
            currentColumn: { statusName: 'CURRENT', tasks: expect.any(Array) },
            previousColumn: { statusName: 'PREVIOUS' }, nextColumn: { statusName: 'NEXT' },
        });
    }
    const moved = await call('PATCH', ['tasks', order.taskIds[0], 'status'], {
        nextStatusId: workflow.steps[0].toStatusId, assignedUserId: actor.id, comment: 'Moved from frontend',
    });
    expect(moved.status).toBe(204);
    const movedHistory = await call('GET', ['order-tasks', order.taskIds[0], 'history']);
    expect(movedHistory.status).toBe(200);
    expect(await movedHistory.json()).toMatchObject({ content: expect.arrayContaining([
        expect.objectContaining({ fieldName: 'STATUS', newValue: workflow.steps[0].toStatusCode }),
    ]) });
    const reworkOptions = await call('GET', ['tasks', order.taskIds[0], 'rework-options']);
    expect(reworkOptions.status).toBe(200);
    expect(await reworkOptions.json()).toEqual([]);
    const rework = await call('POST', ['order-tasks', order.taskIds[0], 'return-for-rework'], {
        targetStatusId: workflow.steps[0].fromStatusId, assignedTo: actor.id,
        incidentType: 'REWORK', reasonCode: 'FRONTEND_CHECK', description: 'Return from frontend',
    });
    expect(rework.status).toBe(201);
    expect(await rework.json()).toMatchObject({ taskId: order.taskIds[0], status: 'OPEN', assignedTo: actor.id, incidentType: 'REWORK' });
    const registered = await call('POST', ['tasks', order.taskIds[0], 'quality-incidents'], {
        incidentType: 'DEFECT', reasonCode: 'INSPECTION', description: 'Quality check from frontend',
    });
    expect(registered.status).toBe(200);
    const incident = await registered.json();
    expect(incident).toMatchObject({ status: 'OPEN', assignedTo: null });
    const deliveredNotifications = await call('GET', ['notifications'], undefined, '?size=100');
    expect(deliveredNotifications.status).toBe(200);
    const deliveredPage = await deliveredNotifications.json();
    const deliveredNotification = deliveredPage.content.find((item: { resourceId: string }) => item.resourceId === order.taskIds[0]);
    expect(deliveredNotification).toBeDefined();
    const markRead = await call('PATCH', ['notifications', deliveredNotification.id, 'read']);
    expect(markRead.status).toBe(204);
    expect(await markRead.text()).toBe('');
    const incidents = await call('GET', ['tasks', order.taskIds[0], 'quality-incidents'], undefined, '?size=1');
    expect(incidents.status).toBe(200);
    expect(await incidents.json()).toMatchObject({ number: 0, size: 1, totalElements: 2, totalPages: 2, last: false });
    const resolved = await call('PATCH', ['tasks', order.taskIds[0], 'quality-incidents', incident.id, 'resolve'], {
        resolutionComment: 'Checked and corrected',
    });
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toMatchObject({ id: incident.id, status: 'RESOLVED', resolutionComment: 'Checked and corrected', resolvedAt: expect.any(String) });
    for (const prefix of ['tasks', 'order-tasks']) {
        const calendar = await call('GET', [prefix, 'calendar', 'my'], undefined, '?year=2031&month=2');
        expect(calendar.status).toBe(200);
        expect(await calendar.json()).toMatchObject({ year: 2031, month: 2, days: expect.arrayContaining([
            expect.objectContaining({ date: '2031-02-03', taskCount: expect.any(Number), tasks: expect.arrayContaining([
                expect.objectContaining({ taskId: order.taskIds[0], orderId: order.id, deadline: '2031-02-03', patientName: 'Web patient' }),
            ]) }),
        ]) });
    }
    expect((await call('PATCH', ['orders', order.id, 'status'])).status).toBe(204);
    expect((await call('DELETE', ['orders', order.id])).status).toBe(204);




    const orders = await call('GET', ['orders'], undefined, '?size=1');
    expect(orders.status).toBe(200);
    expect(await orders.json()).toMatchObject({ content: expect.any(Array), size: 1, number: 0, sort: { sorted: true } });
    const task = process.env.GO_ASSIGNMENT_TEST_TASK_ID!;
    expect(task).toBeTruthy();
    const plan = await call('PATCH', ['tasks', task, 'assignment'], { assignmentMode: 'AUTO' });
    expect(plan.status).toBe(200);
    expect(await plan.json()).toEqual({ assignmentMode: 'AUTO', statusAssignees: [] });
    const assigned = await call('PATCH', ['order-tasks', task, 'assign', actor.id]);
    expect(assigned.status).toBe(204);
    const readPlan = await call('GET', ['tasks', task, 'assignment']);
    expect(readPlan.status).toBe(200);
    expect(await readPlan.json()).toEqual({ assignmentMode: 'AUTO', statusAssignees: [] });
}, 30000);

// Enabled by the migration harness only, against its disposable PostgreSQL.
// Production route handlers and fetch are used directly, without backend mocks.
test.skipIf(!backend)('existing Next.js auth routes accept Go login, refresh cookies, and revoke logout', async () => {
    vi.stubEnv('BACKEND_API_BASE_URL', backend!);
    vi.resetModules();
    const proxy = await import('@/src/app/api/backend/[...path]/route');
    const session = await import('@/src/app/api/auth/session/route');
    const logout = await import('@/src/app/api/auth/logout/route');
    const response = await proxy.POST(new NextRequest('http://localhost:3000/api/backend/auth/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'admin@teethtech.kz', password: 'adminTeethtech' }),
    }), { params: Promise.resolve({ path: ['auth', 'sessions'] }) });
    expect(response.status).toBe(200);
    const user = await response.json();
    expect(user).toEqual({ id: expect.any(String), email: 'admin@teethtech.kz', roles: expect.arrayContaining(['ROLE_ADMIN']) });
    const access = response.cookies.get('teethTechJwt');
    const refresh = response.cookies.get('teethTechRefresh');
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(refresh?.sameSite).toBe('strict');
    expect(access?.value).toBeTruthy();
    expect(refresh?.value).toBeTruthy();

    // No access cookie: the actual frontend handler must refresh through Go.
    const renewed = await session.GET(new NextRequest('http://localhost:3000/api/auth/session', {
        headers: { cookie: `teethTechRefresh=${refresh!.value}` },
    }));
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toEqual(user);
    const nextRefresh = renewed.cookies.get('teethTechRefresh');
    expect(nextRefresh?.value).toBeTruthy();
    expect(nextRefresh?.value).not.toBe(refresh!.value);

    const cookies = renewed.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const loggedOut = await logout.POST(new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST', headers: { origin: 'http://localhost:3000', cookie: cookies },
    }));
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.cookies.get('teethTechJwt')?.maxAge).toBe(0);
    expect(loggedOut.cookies.get('teethTechRefresh')?.maxAge).toBe(0);
    const rejected = await session.GET(new NextRequest('http://localhost:3000/api/auth/session', {
        headers: { cookie: `teethTechRefresh=${nextRefresh!.value}` },
    }));
    expect(rejected.status).toBe(401);
}, 30000);

test.skipIf(!backend)('existing Next.js proxy supports catalogs and clinic pages against Go', async () => {
    vi.stubEnv('BACKEND_API_BASE_URL', backend!);
    vi.resetModules();
    const proxy = await import('@/src/app/api/backend/[...path]/route');
    const login = await proxy.POST(new NextRequest('http://localhost:3000/api/backend/auth/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'admin@teethtech.kz', password: 'adminTeethtech' }),
    }), { params: Promise.resolve({ path: ['auth', 'sessions'] }) });
    expect(login.status).toBe(200);
    const cookies = login.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const call = async (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string[], body?: unknown, query = '') =>
        proxy[method](new NextRequest(`http://localhost:3000/api/backend/${path.join('/')}${query}`, {
            method, headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', cookie: cookies },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }), { params: Promise.resolve({ path }) });
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
    for (const kind of ['colors', 'work-types', 'work-directions']) {
        const response = await call('POST', [kind], { code: `W_${suffix}`, name: `Web ${suffix}`, active: true, isActive: true });
        expect(response.status).toBe(201);
        const entry = await response.json();
        expect((await call(kind === 'work-directions' ? 'PATCH' : 'PUT', [kind, entry.id], {
            code: entry.code, name: 'Updated via frontend', active: false, isActive: false,
        })).status).toBe(200);
        const filtered = await call('GET', [kind], undefined, kind === 'work-directions' ? '?includeInactive=false' : '?activeOnly=true');
        expect(filtered.status).toBe(200);
        expect(await filtered.json()).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: entry.id })]));
        if (kind !== 'work-directions') expect((await call('DELETE', [kind, entry.id])).status).toBe(204);
    }
    const materialResponse = await call('POST', ['materials'], {
        name: `Web material ${suffix}`, nomenclatureCode: `WEB_${suffix}`, unit: 'g', description: 'Frontend fixture',
    });
    expect(materialResponse.status).toBe(201);
    const material = await materialResponse.json();
    expect(material).toMatchObject({ isActive: true, currentStock: 0, nomenclatureId: expect.any(String) });
    expect((await call('PUT', ['materials', material.id], { unit: 'kg' })).status).toBe(200);
    expect(await (await call('GET', ['materials', material.id])).json()).toMatchObject({ unit: 'kg' });
    expect((await call('DELETE', ['materials', material.id])).status).toBe(204);

    const created = await call('POST', ['clinics'], { name: `Web clinic ${suffix}`, phone: '', email: '', bin: '' });
    expect(created.status).toBe(201);
    const id = await created.json();
    expect(typeof id).toBe('string');
    const patched = await call('PATCH', ['clinics', id], { name: `Web clinic ${suffix}`, address: 'New address' });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ id, address: 'New address', totalOrdersCount: 0, totalDebt: 0 });
    const search = await call('GET', ['clinics', 'search'], undefined, `?name=${suffix}&page=0&size=1&sort=name,ASC`);
    expect(search.status).toBe(200);
    expect(await search.json()).toMatchObject({ content: [expect.objectContaining({ id })], number: 0, size: 1, first: true, last: true });
    for (const kind of ['doctors', 'patients', 'orders']) {
        const page = await call('GET', ['clinics', id, kind], undefined, '?page=0&size=5');
        expect(page.status).toBe(200);
        expect(await page.json()).toMatchObject({ content: [], size: 5, empty: true, last: true });
    }
    expect((await call('DELETE', ['clinics', id])).status).toBe(204);
    expect((await call('GET', ['clinics', id])).status).toBe(404);
}, 30000);

test.skipIf(!backend)('existing Next.js proxy supports employee and role management against Go', async () => {
    vi.stubEnv('BACKEND_API_BASE_URL', backend!);
    vi.resetModules();
    const proxy = await import('@/src/app/api/backend/[...path]/route');
    const login = await proxy.POST(new NextRequest('http://localhost:3000/api/backend/auth/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'admin@teethtech.kz', password: 'adminTeethtech' }),
    }), { params: Promise.resolve({ path: ['auth', 'sessions'] }) });
    expect(login.status).toBe(200);
    const cookies = login.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const call = async (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string[], body?: unknown) => {
        return proxy[method](new NextRequest(`http://localhost:3000/api/backend/${path.join('/')}`, {
            method, headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', cookie: cookies },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }), { params: Promise.resolve({ path }) });
    };
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const createdRole = await call('POST', ['roles'], { code: `web_${suffix}`, name: 'Frontend integration role' });
    expect(createdRole.status).toBe(201);
    const role = await createdRole.json();
    expect(role).toMatchObject({ code: `ROLE_WEB_${suffix.toUpperCase()}`, systemManaged: false, deletable: true });
    expect((await call('PATCH', ['roles', role.id], { name: 'Renamed integration role' })).status).toBe(200);
    const roles = await call('GET', ['roles']);
    expect(await roles.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: role.id, name: 'Renamed integration role' })]));

    const batch = await call('POST', ['users', 'batch'], { employees: [{
        fullName: 'Frontend integration employee', email: `web-${suffix}@example.invalid`,
        phone: '+77771234567', role: 'DISPATCHER', password: 'Frontend-pass-123', workDirectionIds: [],
    }] });
    expect(batch.status).toBe(201);
    const [id] = await batch.json();
    expect(typeof id).toBe('string');
    expect((await call('PATCH', ['users', id], { name: 'Renamed employee' })).status).toBe(204);
    const employees = await call('GET', ['users']);
    expect(await employees.json()).toEqual(expect.arrayContaining([expect.objectContaining({
        id, fullName: 'Renamed employee', roles: ['ROLE_DISPATCHER'], status: 'ACTIVE', workDirections: [],
        stats: expect.objectContaining({ completed: expect.any(Number), avgDays: expect.any(Number), timelyPercent: expect.any(Number) }),
    })]));
    expect((await call('POST', ['users', id, 'change-password'], { newPassword: 'Frontend-changed-456' })).status).toBe(204);
    expect((await call('PATCH', ['users', id, 'admin-setup'], { roles: ['DISPATCHER'], status: 'ACTIVE' })).status).toBe(204);
    expect((await call('PATCH', ['users', id, 'status'], { status: 'INACTIVE' })).status).toBe(204);
    expect((await call('DELETE', ['users', id])).status).toBe(204);
    expect((await call('DELETE', ['roles', role.id])).status).toBe(204);
}, 30000);
