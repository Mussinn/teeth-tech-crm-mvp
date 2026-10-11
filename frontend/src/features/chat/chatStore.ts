import type {
	ChatMemberDto,
	ChatMessageDto,
	ChatRealtimeEvent,
	ChatSummaryDto
} from '@/src/types/chat.types'
import { appendMessageToEnd, normalizeMessages } from '@/src/utils/chatUtils'
import { create, type StateCreator } from 'zustand'

type ChatStoreState = {
	chats: ChatSummaryDto[]
	messagesByConversation: Record<string, ChatMessageDto[]>
	membersByConversation: Record<string, ChatMemberDto[]>
	activeConversationId: string | null
	isLoadingChats: boolean
	isLoadingMessages: boolean
	isLoadingMembers: boolean
	hasMoreByConversation: Record<string, boolean>
	nextBeforeByConversation: Record<string, string | null>
	pendingMessageIds: string[]
	setChats: (chats: ChatSummaryDto[]) => void
	upsertChat: (chat: ChatSummaryDto) => void
	setActiveConversation: (conversationId: string | null) => void
	setMessages: (conversationId: string, messages: ChatMessageDto[]) => void
	appendMessages: (
		conversationId: string,
		messages: ChatMessageDto[],
		prepend?: boolean
	) => void
	appendMessage: (message: ChatMessageDto) => void
	setMembers: (conversationId: string, members: ChatMemberDto[]) => void
	setLoadingChats: (value: boolean) => void
	setLoadingMessages: (value: boolean) => void
	setLoadingMembers: (value: boolean) => void
	setPagination: (
		conversationId: string,
		hasMore: boolean,
		nextBefore: string | null
	) => void
	setPendingMessageId: (messageId: string | null) => void
	clearPendingMessageId: (messageId: string) => void
	applyRealtimeEvent: (event: ChatRealtimeEvent) => void
}

const chatStoreCreator: StateCreator<ChatStoreState> = (set, get) => ({
	chats: [],
	messagesByConversation: {},
	membersByConversation: {},
	activeConversationId: null,
	isLoadingChats: false,
	isLoadingMessages: false,
	isLoadingMembers: false,
	hasMoreByConversation: {},
	nextBeforeByConversation: {},
	pendingMessageIds: [],
	setChats: (chats: ChatSummaryDto[]) => set({ chats }),
	upsertChat: (chat: ChatSummaryDto) => {
		const currentChats = get().chats
		const nextChats = currentChats.some(
			(item: ChatSummaryDto) => item.id === chat.id
		)
			? currentChats.map((item: ChatSummaryDto) =>
					item.id === chat.id ? { ...item, ...chat } : item
				)
			: [chat, ...currentChats]
		set({ chats: nextChats })
	},
	setActiveConversation: (conversationId: string | null) =>
		set({ activeConversationId: conversationId }),
	setMessages: (conversationId: string, messages: ChatMessageDto[]) => {
		const normalized = normalizeMessages(messages)
		set(state => ({
			messagesByConversation: {
				...state.messagesByConversation,
				[conversationId]: normalized
			}
		}))
	},
	appendMessages: (
		conversationId: string,
		messages: ChatMessageDto[],
		prepend = false
	) => {
		const normalized = normalizeMessages(messages)
		set(state => {
			const existing = state.messagesByConversation[conversationId] ?? []
			const merged = prepend
				? normalizeMessages([...normalized, ...existing])
				: normalizeMessages([...existing, ...normalized])
			return {
				messagesByConversation: {
					...state.messagesByConversation,
					[conversationId]: merged
				}
			}
		})
	},
	appendMessage: (message: ChatMessageDto) => {
		set(state => {
			const existing =
				state.messagesByConversation[message.conversationId] ?? []
			const next = appendMessageToEnd(existing, message)
			return {
				messagesByConversation: {
					...state.messagesByConversation,
					[message.conversationId]: next
				}
			}
		})
	},
	setMembers: (conversationId: string, members: ChatMemberDto[]) =>
		set(state => ({
			membersByConversation: {
				...state.membersByConversation,
				[conversationId]: members
			}
		})),
	setLoadingChats: (value: boolean) => set({ isLoadingChats: value }),
	setLoadingMessages: (value: boolean) => set({ isLoadingMessages: value }),
	setLoadingMembers: (value: boolean) => set({ isLoadingMembers: value }),
	setPagination: (
		conversationId: string,
		hasMore: boolean,
		nextBefore: string | null
	) =>
		set(state => ({
			hasMoreByConversation: {
				...state.hasMoreByConversation,
				[conversationId]: hasMore
			},
			nextBeforeByConversation: {
				...state.nextBeforeByConversation,
				[conversationId]: nextBefore
			}
		})),
	setPendingMessageId: (messageId: string | null) =>
		set(state => ({
			pendingMessageIds: messageId
				? [...state.pendingMessageIds, messageId]
				: state.pendingMessageIds
		})),
	clearPendingMessageId: (messageId: string) =>
		set(state => ({
			pendingMessageIds: state.pendingMessageIds.filter(
				(id: string) => id !== messageId
			)
		})),
	applyRealtimeEvent: (event: ChatRealtimeEvent) => {
		if (event.type === 'MESSAGE_CREATED' && event.message) {
			const message = event.message
			get().appendMessage(message)
			get().upsertChat({
				id: message.conversationId,
				type: 'DIRECT',
				title: message.senderName,
				lastMessage: message.text ?? '📎',
				lastMessageAt: message.createdAt,
				unreadCount: 0
			})
		}
	}
})

export const useChatStore = create<ChatStoreState>(chatStoreCreator)
