'use client'

import {
	receiveIncomingMessage,
	setChats
} from '@/src/features/chat/chatSlice'
import { enqueueNotification } from '@/src/features/notifications/notificationsSlice'
import type { AppDispatch, RootState } from '@/src/lib/store'
import { useGetChatsQuery } from '@/src/services/api/chatApi'
import {
	addChatRealtimeListener,
	addChatRealtimeReconnectListener,
	connectChatRealtime,
	disconnectChatRealtime,
	removeChatRealtimeListener,
	removeChatRealtimeReconnectListener,
	sendChatRead
} from '@/src/services/chatRealtimeService'
import type { ChatMessageDto, ChatRealtimeEvent } from '@/src/types/chat.types'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

type PermissionState = NotificationPermission | 'unsupported'

function normalizeRealtimeMessage(event: ChatRealtimeEvent, userFallback: string): ChatMessageDto | null {
	if (!event.message) return null
	const source = event.message
	const conversationId = source.conversationId || event.conversationId
	if (!conversationId) return null

	return {
		...source,
		id:
			source.id ||
			`realtime-${conversationId}-${event.occurredAt || source.createdAt || Date.now()}`,
		conversationId,
		senderId: source.senderId || '',
		senderName: source.senderName || userFallback,
		text: source.text ?? null,
		replyToId: source.replyToId ?? null,
		createdAt: source.createdAt || event.occurredAt || new Date().toISOString(),
		editedAt: source.editedAt ?? null,
		deleted: source.deleted ?? false,
		attachments: source.attachments ?? []
	}
}

function playMessageSound(contextRef: React.MutableRefObject<AudioContext | null>) {
	const AudioContextCtor =
		window.AudioContext ||
		(window as typeof window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext
	if (!AudioContextCtor) return

	const context = contextRef.current ?? new AudioContextCtor()
	contextRef.current = context
	const playTone = () => {
		const oscillator = context.createOscillator()
		const gain = context.createGain()
		oscillator.type = 'sine'
		oscillator.frequency.setValueAtTime(880, context.currentTime)
		oscillator.frequency.exponentialRampToValueAtTime(
			1175,
			context.currentTime + 0.12
		)
		gain.gain.setValueAtTime(0.0001, context.currentTime)
		gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015)
		gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32)
		oscillator.connect(gain)
		gain.connect(context.destination)
		oscillator.start()
		oscillator.stop(context.currentTime + 0.34)
	}

	if (context.state === 'running') playTone()
	else void context.resume().then(playTone).catch(() => undefined)
}

export default function ChatNotifications() {
	const t = useTranslations('chat.notifications')
	const chatT = useTranslations('chat')
	const dispatch = useDispatch<AppDispatch>()
	const pathname = usePathname()
	const { id: currentUserId } = useSelector((state: RootState) => state.auth)
	const { activeConversationId, chats } = useSelector((state: RootState) => state.chat)
	const { data: initialChats, refetch: refetchChats } = useGetChatsQuery(
		undefined,
		{ refetchOnMountOrArgChange: true }
	)
	const [permission, setPermission] = useState<PermissionState>('default')
	const audioContextRef = useRef<AudioContext | null>(null)
	const handledMessageIdsRef = useRef<Set<string>>(new Set())
	const stateRef = useRef({ currentUserId, activeConversationId, chats, pathname })

	useEffect(() => {
		stateRef.current = { currentUserId, activeConversationId, chats, pathname }
	}, [activeConversationId, chats, currentUserId, pathname])

	useEffect(() => {
		if (initialChats) dispatch(setChats(initialChats))
	}, [dispatch, initialChats])

	useEffect(() => {
		const permissionTimer = window.setTimeout(() => {
			setPermission(
				'Notification' in window ? Notification.permission : 'unsupported'
			)
		}, 0)
		const unlockAudio = () => {
			const AudioContextCtor =
				window.AudioContext ||
				(window as typeof window & { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext
			if (!AudioContextCtor) return
			const context = audioContextRef.current ?? new AudioContextCtor()
			audioContextRef.current = context
			if (context.state === 'suspended') void context.resume()
		}
		window.addEventListener('pointerdown', unlockAudio, { once: true })
		window.addEventListener('keydown', unlockAudio, { once: true })
		return () => {
			window.clearTimeout(permissionTimer)
			window.removeEventListener('pointerdown', unlockAudio)
			window.removeEventListener('keydown', unlockAudio)
			void audioContextRef.current?.close()
		}
	}, [])

	useEffect(() => {
		connectChatRealtime()
		const reconnectListener = () => {
			void refetchChats()
		}
		const listener = (event: ChatRealtimeEvent) => {
			if (event.type !== 'MESSAGE_CREATED' || !event.message) return

			const message = normalizeRealtimeMessage(event, chatT('userFallback'))
			if (!message) return
			const current = stateRef.current
			if (message.senderId && message.senderId === current.currentUserId) return

			const eventKey =
				message.id ||
				`${message.conversationId}:${message.senderId}:${message.createdAt}:${message.text}`
			if (handledMessageIdsRef.current.has(eventKey)) return
			handledMessageIdsRef.current.add(eventKey)
			if (handledMessageIdsRef.current.size > 300) {
				const oldestKey = handledMessageIdsRef.current.values().next().value
				if (oldestKey) handledMessageIdsRef.current.delete(oldestKey)
			}

			const isConversationOpen =
				current.activeConversationId === message.conversationId &&
				current.pathname === `/chats/${message.conversationId}` &&
				document.visibilityState === 'visible'

			dispatch(receiveIncomingMessage({ message, isConversationOpen }))
			playMessageSound(audioContextRef)
			if (isConversationOpen) {
				sendChatRead(message.conversationId)
			}

			dispatch(
				enqueueNotification({
					tone: 'message',
					title: message.senderName || t('newMessage'),
					message: message.text?.trim() || t('attachment'),
					href: `/chats/${message.conversationId}`,
					duration: 6000
				})
			)
			if (
				document.visibilityState !== 'visible' &&
				'Notification' in window &&
				Notification.permission === 'granted'
			) {
				const chat = current.chats.find(item => item.id === message.conversationId)
				const notification = new Notification(chat?.title ?? message.senderName ?? 'TeethTech CRM', {
					body: message.text?.trim() || t('attachment'),
					tag: `chat-${message.conversationId}`,
					silent: false
				})
				notification.onclick = () => {
					window.focus()
					window.location.assign(`/chats/${message.conversationId}`)
					notification.close()
				}
			}
		}
		addChatRealtimeListener(listener)
		addChatRealtimeReconnectListener(reconnectListener)
		return () => {
			removeChatRealtimeListener(listener)
			removeChatRealtimeReconnectListener(reconnectListener)
			disconnectChatRealtime()
		}
	}, [chatT, dispatch, refetchChats, t])

	const requestPermission = useCallback(async () => {
		if (!('Notification' in window)) return
		const nextPermission = await Notification.requestPermission()
		setPermission(nextPermission)
	}, [])

	if (permission !== 'default') return null

	return (
		<aside className="fixed bottom-4 left-1/2 z-[110] flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-[22px] border border-violet-200 bg-white p-3.5 shadow-[0_20px_60px_-20px_rgba(15,23,42,.45)] dark:border-violet-500/30 dark:bg-slate-900" role="status">
			<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round"/></svg></span>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-black text-slate-900 dark:text-white">{t('title')}</p>
				<p className="text-xs text-slate-500">{t('body')}</p>
			</div>
			<button type="button" onClick={() => void requestPermission()} className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
				{t('allow')}
			</button>
		</aside>
	)
}
