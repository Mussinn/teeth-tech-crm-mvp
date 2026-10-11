import { isSameOriginRequest } from '@/src/lib/requestOrigin'
import { NextRequest, NextResponse } from 'next/server'

import { defaultLocale, isLocale, localeCookieName } from '@/src/i18n/config'
import {
    AUTH_TOKEN_COOKIE,
    clearAuthCookies,
    isSecureRequest,
    setAuthCookies
} from '@/src/lib/serverAuthCookies'
import {
    createBackendSessionResult,
    getSessionFromBackendAuth,
    refreshBackendSessionResult
} from '@/src/lib/serverAuthApi'
import { INACTIVE_ACCOUNT_MESSAGE } from '@/src/lib/inactiveAccount'
import enMessages from '@/src/messages/en/apiNotifications'
import kkMessages from '@/src/messages/kk/apiNotifications'
import ruMessages from '@/src/messages/ru/apiNotifications'

export const dynamic = 'force-dynamic'

type RouteContext = {
	params: Promise<{
		path?: string[]
	}>
}

// ============================================
// ⭐ КОНФИГУРАЦИЯ URL ДЛЯ ПРОКСИ (ИСПРАВЛЕНО)
// ============================================

/**
 * Определяет базовый URL для API бэкенда
 * Приоритет:
 * 1. BACKEND_API_BASE_URL - для продакшена (Docker)
 * 2. NEXT_PUBLIC_API_URL - для разработки
 * 3. Дефолт - localhost:8081
 */
function getBackendApiBaseUrl(): string {
	// 1. Для продакшена (Docker) - используем BACKEND_API_BASE_URL
	if (process.env.BACKEND_API_BASE_URL) {
		return process.env.BACKEND_API_BASE_URL
	}

	// 2. Для разработки - используем NEXT_PUBLIC_API_URL
	if (process.env.NEXT_PUBLIC_API_URL) {
		return process.env.NEXT_PUBLIC_API_URL
	}

	// 3. Дефолт для локальной разработки
	return 'http://localhost:8081/api/v1'
}

/**
 * Определяет базовый URL для WebSocket
 */
function getBackendWsBaseUrl(): string {
	if (process.env.BACKEND_WS_BASE_URL) {
		return process.env.BACKEND_WS_BASE_URL
	}

	if (process.env.NEXT_PUBLIC_WS_URL) {
		return process.env.NEXT_PUBLIC_WS_URL
	}

	const apiUrl = getBackendApiBaseUrl()
	return `${apiUrl.replace(/\/+$/u, '')}/ws-crm`
}

const BACKEND_API_BASE_URL = getBackendApiBaseUrl()
const BACKEND_WS_BASE_URL = getBackendWsBaseUrl()

// Логирование для отладки (только в development)
if (process.env.NODE_ENV === 'development') {
	console.log('🔧 [Proxy] Backend API URL:', BACKEND_API_BASE_URL)
	console.log('🔧 [Proxy] Backend WS URL:', BACKEND_WS_BASE_URL)
}

// ============================================
// КОНСТАНТЫ
// ============================================

const BODYLESS_METHODS = new Set(['GET', 'HEAD'])
const BODYLESS_STATUSES = new Set([204, 304])
const REQUEST_HEADERS_TO_SKIP = new Set([
	'accept-encoding',
	'authorization',
	'connection',
	'content-length',
	'cookie',
	'host',
	'origin',
	'referer',
	'x-organization-id',
	'x-tenant-id',
	'x-user-id',
	'x-user-role',
	'x-user-roles',
	'x-forwarded-for',
	'x-forwarded-host',
	'x-forwarded-proto',
	'x-real-ip'
])
const RESPONSE_HEADERS_TO_SKIP = new Set([
	'connection',
	'content-encoding',
	'content-length',
	'set-cookie',
	'transfer-encoding'
])

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function getProxyMessages(request: NextRequest) {
	const savedLocale = request.cookies.get(localeCookieName)?.value
	const locale = isLocale(savedLocale) ? savedLocale : defaultLocale
	return { ru: ruMessages, en: enMessages, kk: kkMessages }[locale].proxy
}

const TENANT_QUERY_PARAMETERS = new Set([
	'organizationid',
	'organization-id',
	'tenantid',
	'tenant-id'
])

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const BFF_ONLY_AUTH_PATHS = new Set([
	'auth/login',
	'auth/sessions/refresh',
	'auth/sessions/logout'
])

function buildBackendUrl(path: string[], request: NextRequest) {
	const isSockJsRequest = path[0] === 'ws-crm'
	const targetPath = isSockJsRequest ? path.slice(1) : path
	const encodedPath = targetPath
		.map(segment => encodeURIComponent(segment))
		.join('/')
	const baseUrl = (
		isSockJsRequest ? BACKEND_WS_BASE_URL : BACKEND_API_BASE_URL
	).replace(/\/+$/u, '')
	const targetUrl = new URL(`${baseUrl}/${encodedPath}`)

	request.nextUrl.searchParams.forEach((value, key) => {
		if (TENANT_QUERY_PARAMETERS.has(key.toLowerCase())) return
		targetUrl.searchParams.append(key, value)
	})

	return targetUrl
}

function buildRequestHeaders(request: NextRequest, token: string) {
	const headers = new Headers()

	request.headers.forEach((value, key) => {
		const normalizedKey = key.toLowerCase()

		if (
			REQUEST_HEADERS_TO_SKIP.has(normalizedKey) ||
			normalizedKey.startsWith('sec-fetch-')
		) {
			return
		}

		headers.set(key, value)
	})

	headers.set('Authorization', `Bearer ${token}`)

	return headers
}

function isMultipartRequest(request: NextRequest) {
	return (
		request.headers
			.get('content-type')
			?.toLowerCase()
			.startsWith('multipart/form-data') ?? false
	)
}

function buildResponseHeaders(headers: Headers) {
	const responseHeaders = new Headers()

	headers.forEach((value, key) => {
		if (!RESPONSE_HEADERS_TO_SKIP.has(key.toLowerCase())) {
			responseHeaders.set(key, value)
		}
	})

	return responseHeaders
}

function makeProxyResponse(
	body: ArrayBuffer,
	backendResponse: Response,
	request: NextRequest
) {
	const responseBody =
		BODYLESS_STATUSES.has(backendResponse.status) || request.method === 'HEAD'
			? null
			: body

	return new NextResponse(responseBody, {
		status: backendResponse.status,
		statusText: backendResponse.statusText,
		headers: buildResponseHeaders(backendResponse.headers)
	})
}

function parseLoginRequest(body: ArrayBuffer): { email: string; password: string } | null {
	try {
		const value = JSON.parse(new TextDecoder().decode(body)) as {
			email?: unknown
			password?: unknown
		}

		if (typeof value.email !== 'string' || typeof value.password !== 'string') {
			return null
		}

		return { email: value.email, password: value.password }
	} catch {
		return null
	}
}

async function getRequestBody(request: NextRequest) {
	if (BODYLESS_METHODS.has(request.method)) return undefined

	if (isMultipartRequest(request)) {
		return request.formData()
	}

	return request.arrayBuffer()
}

function isAllowedUnsafeRequest(request: NextRequest) {
	if (!UNSAFE_METHODS.has(request.method)) return true

	return isSameOriginRequest(request)
}

function csrfRejected() {
	return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ПРОКСИ
// ============================================

async function proxyRequest(request: NextRequest, context: RouteContext) {
	const proxyMessages = getProxyMessages(request)
	const { path = [] } = await context.params
	const isLoginRequest =
		request.method === 'POST' && path.join('/') === 'auth/sessions'
	const requestPath = path.join('/')

	if (!isAllowedUnsafeRequest(request)) return csrfRejected()

	if (BFF_ONLY_AUTH_PATHS.has(requestPath)) {
		return NextResponse.json({ message: 'Not found' }, { status: 404 })
	}

	if (isLoginRequest) {
		const login = parseLoginRequest(await request.arrayBuffer())

		if (!login) return NextResponse.json({ message: 'Invalid request' }, { status: 400 })

		const attempt = await createBackendSessionResult(login.email, login.password)
		if (!attempt.auth) {
			if (attempt.inactive) return inactiveUnauthorizedResponse()
			return NextResponse.json(
				{ message: 'Unauthorized' },
				{ status: 401 }
			)
		}
		const auth = attempt.auth

		const session = getSessionFromBackendAuth(auth)
		const response = NextResponse.json(session)
		setAuthCookies(response, auth, session, isSecureRequest(request))

		return response
	}

	let token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value
	let refreshedAuth: Awaited<ReturnType<typeof refreshBackendSessionResult>>['auth'] = null

	if (!token) {
		const refreshAttempt = await refreshBackendSessionResult(request)
		if (refreshAttempt.inactive) return inactiveUnauthorizedResponse()
		refreshedAuth = refreshAttempt.auth
		token = refreshedAuth?.accessToken
	}

	if (!token) return unauthorizedResponse()

	const targetUrl = buildBackendUrl(path, request)
	const body = await getRequestBody(request)
	const headers = buildRequestHeaders(request, token)

	if (isMultipartRequest(request)) {
		headers.delete('content-type')
	}

	try {
		let backendResponse = await fetch(targetUrl, {
			method: request.method,
			headers,
			body,
			cache: 'no-store',
			redirect: 'manual'
		})

		if (backendResponse.status === 401 && !refreshedAuth) {
			const refreshAttempt = await refreshBackendSessionResult(request)
			if (refreshAttempt.inactive) return inactiveUnauthorizedResponse()
			refreshedAuth = refreshAttempt.auth

			if (refreshedAuth) {
				headers.set('Authorization', `Bearer ${refreshedAuth.accessToken}`)
				backendResponse = await fetch(targetUrl, {
					method: request.method,
					headers,
					body,
					cache: 'no-store',
					redirect: 'manual'
				})
			}
		}

		const responseBody = await backendResponse.arrayBuffer()

		const response = makeProxyResponse(responseBody, backendResponse, request)
		response.headers.set('Cache-Control', 'no-store, private')

		if (backendResponse.status === 401) {
			clearAuthCookies(response)
		} else if (refreshedAuth) {
			setAuthCookies(
				response,
				refreshedAuth,
				getSessionFromBackendAuth(refreshedAuth),
				isSecureRequest(request)
			)
		}

		return response
	} catch (error) {
		console.error('❌ [Proxy] Backend request failed:', {
			method: request.method,
			pathname: targetUrl.pathname,
			error: error instanceof Error ? error.message : String(error)
		})
		return NextResponse.json(
			{ message: proxyMessages.unavailable },
			{ status: 502 }
		)
	}
}

function unauthorizedResponse() {
	const response = NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	clearAuthCookies(response)
	return response
}

function inactiveUnauthorizedResponse() {
	const response = NextResponse.json(
		{ message: INACTIVE_ACCOUNT_MESSAGE },
		{ status: 401 }
	)
	clearAuthCookies(response)
	return response
}

// ============================================
// ЭКСПОРТЫ HTTP МЕТОДОВ
// ============================================

export async function GET(request: NextRequest, context: RouteContext) {
	return proxyRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
	return proxyRequest(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
	return proxyRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
	return proxyRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
	return proxyRequest(request, context)
}

export async function HEAD(request: NextRequest, context: RouteContext) {
	return proxyRequest(request, context)
}
