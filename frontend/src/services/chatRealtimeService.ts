import type { ChatRealtimeEvent } from '@/src/types/chat.types'
import {
	Client,
	IMessage,
	StompSubscription,
	TickerStrategy
} from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const CHAT_SUBSCRIPTION_DESTINATION = '/user/queue/chat'
const IS_REALTIME_DEBUG_ENABLED = process.env.NODE_ENV !== 'production'

function debugRealtime(message: string, details?: unknown) {
	if (!IS_REALTIME_DEBUG_ENABLED) return
	if (details === undefined) console.info(`[chat-realtime] ${message}`)
	else console.info(`[chat-realtime] ${message}`, details)
}

function getWebSocketEndpoint() {
	const configuredEndpoint = (
		process.env.NEXT_PUBLIC_WS_URL
		?? process.env.NEXT_PUBLIC_BACKEND_WS_URL
	)?.trim()

	if (typeof window === 'undefined') {
		return configuredEndpoint || '/api/v1/ws-crm'
	}

	return new URL(
		configuredEndpoint || '/api/v1/ws-crm',
		window.location.origin
	).toString()
}

type ChatRealtimeListener = (event: ChatRealtimeEvent) => void
type ChatRealtimeReconnectListener = () => void

type ChatRealtimeServiceState = {
	client: Client | null
	activeSubscriptions: Map<string, StompSubscription>
	listeners: Set<ChatRealtimeListener>
	reconnectListeners: Set<ChatRealtimeReconnectListener>
	hasConnectedBefore: boolean
	reconnectAttempt: number
	isConnected: boolean
	isReconnecting: boolean
	isOnline: boolean
	connectionPromise: Promise<void> | null
	consumerCount: number
	disconnectTimer: number | null
}

const state: ChatRealtimeServiceState = {
	client: null,
	activeSubscriptions: new Map(),
	listeners: new Set(),
	reconnectListeners: new Set(),
	hasConnectedBefore: false,
	reconnectAttempt: 0,
	isConnected: false,
	isReconnecting: false,
	isOnline: true,
	connectionPromise: null,
	consumerCount: 0,
	disconnectTimer: null
}

async function getAccessToken(): Promise<string> {
	const response = await fetch('/api/auth/ws-token', {
		cache: 'no-store',
		credentials: 'same-origin'
	})
	if (!response.ok) throw new Error('Realtime authorization failed')
	const payload = (await response.json()) as { token?: string }
	if (!payload.token) throw new Error('Realtime token is missing')
	return payload.token
}

function notifyConnectionStatus() {
	const status = state.isConnected
		? 'connected'
		: state.isReconnecting
			? 'reconnecting'
			: 'offline'
	return status
}

function createClient(accessToken: string) {
	const endpoint = getWebSocketEndpoint()
	const client = new Client({
		webSocketFactory: () => new SockJS(endpoint),
		connectHeaders: {
			Authorization: `Bearer ${accessToken}`
		},
		reconnectDelay: 5000,
		connectionTimeout: 10000,
		heartbeatIncoming: 10000,
		heartbeatOutgoing: 10000,
		heartbeatStrategy: TickerStrategy.Worker,
		debug: () => undefined,
		onConnect: () => {
			const isReconnect = state.hasConnectedBefore
			state.isConnected = true
			state.isReconnecting = false
			state.reconnectAttempt = 0
			state.hasConnectedBefore = true
			subscribeToChat()
			debugRealtime('CONNECTED', {
				endpoint,
				reconnected: isReconnect
			})
			if (isReconnect) {
				state.reconnectListeners.forEach(listener => listener())
			}
		},
		onDisconnect: () => {
			state.isConnected = false
			state.activeSubscriptions.clear()
			debugRealtime('DISCONNECTED')
		},
		onWebSocketClose: event => {
			state.isConnected = false
			state.isReconnecting = true
			state.activeSubscriptions.clear()
			debugRealtime('CLOSED', { code: event.code, reason: event.reason })
		},
		onWebSocketError: event => {
			state.isConnected = false
			state.isReconnecting = true
			debugRealtime('SOCKET_ERROR', event)
		},
		onStompError: frame => {
			debugRealtime('STOMP_ERROR', {
				message: frame.headers.message,
				body: frame.body
			})
		}
	})

	return client
}

function subscribeToChat() {
	if (!state.client?.connected) return
	if (state.activeSubscriptions.has(CHAT_SUBSCRIPTION_DESTINATION)) return

	const subscription = state.client.subscribe(
		CHAT_SUBSCRIPTION_DESTINATION,
		(message: IMessage) => {
			try {
				const payload = JSON.parse(message.body) as ChatRealtimeEvent
				debugRealtime('MESSAGE_RECEIVED', payload)
				state.listeners.forEach(listener => listener(payload))
			} catch (error) {
				console.error('Failed to parse chat realtime payload', error)
			}
		}
	)

	state.activeSubscriptions.set(CHAT_SUBSCRIPTION_DESTINATION, subscription)
	debugRealtime('SUBSCRIBED', CHAT_SUBSCRIPTION_DESTINATION)
}

async function ensureConnection() {
	if (state.client?.active || state.client?.connected) return
	if (state.connectionPromise) return state.connectionPromise

	state.connectionPromise = (async () => {
		const accessToken = await getAccessToken()
		debugRealtime('CONNECTING', getWebSocketEndpoint())
		if (!state.client) state.client = createClient(accessToken)
		state.client.activate()
	})()

	try {
		await state.connectionPromise
	} catch (error) {
		state.isConnected = false
		state.isReconnecting = false
		console.error('Failed to connect chat realtime', error)
	} finally {
		state.connectionPromise = null
	}
}

export function connectChatRealtime() {
	state.consumerCount += 1
	if (state.disconnectTimer !== null) {
		window.clearTimeout(state.disconnectTimer)
		state.disconnectTimer = null
	}
	void ensureConnection()
}

export function disconnectChatRealtime() {
	state.consumerCount = Math.max(0, state.consumerCount - 1)
	if (state.consumerCount > 0 || state.disconnectTimer !== null) return

	state.disconnectTimer = window.setTimeout(() => {
		state.disconnectTimer = null
		if (state.consumerCount > 0) return
		void state.client?.deactivate()
		state.client = null
		state.isConnected = false
		state.isReconnecting = false
		state.reconnectAttempt = 0
		state.activeSubscriptions.clear()
		state.connectionPromise = null
		state.hasConnectedBefore = false
	}, 0)
}

export function resetChatRealtime() {
	if (state.disconnectTimer !== null) {
		window.clearTimeout(state.disconnectTimer)
		state.disconnectTimer = null
	}

	state.consumerCount = 0
	void state.client?.deactivate()
	state.client = null
	state.isConnected = false
	state.isReconnecting = false
	state.reconnectAttempt = 0
	state.activeSubscriptions.clear()
	state.connectionPromise = null
	state.hasConnectedBefore = false
}

export function addChatRealtimeListener(listener: ChatRealtimeListener) {
	state.listeners.add(listener)
}

export function removeChatRealtimeListener(listener: ChatRealtimeListener) {
	state.listeners.delete(listener)
}

export function addChatRealtimeReconnectListener(
	listener: ChatRealtimeReconnectListener
) {
	state.reconnectListeners.add(listener)
}

export function removeChatRealtimeReconnectListener(
	listener: ChatRealtimeReconnectListener
) {
	state.reconnectListeners.delete(listener)
}

export function getChatRealtimeStatus() {
	return notifyConnectionStatus()
}

export function sendChatRead(conversationId: string) {
	if (!state.client?.connected) return

	state.client.publish({
		destination: `/app/chats/${conversationId}/read`,
		body: ''
	})
}

export function sendChatTextMessage(
	conversationId: string,
	payload: { text: string; replyToId?: string | null }
) {
	if (!state.client?.connected) return

	state.client.publish({
		destination: `/app/chats/${conversationId}/messages`,
		body: JSON.stringify(payload)
	})
}

export function getChatRealtimeServiceState() {
	return state
}
