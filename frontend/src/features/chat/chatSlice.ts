import type {
	ChatMemberDto,
	ChatMessageDto,
	ChatRealtimeEvent,
	ChatSummaryDto
} from '@/src/types/chat.types'
import { appendMessageToEnd, normalizeMessages } from '@/src/utils/chatUtils'
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type MessagesByConversation = Record<string, ChatMessageDto[]>
type MembersByConversation = Record<string, ChatMemberDto[]>
type PaginationByConversation = Record<
	string,
	{ hasMore: boolean; nextBefore: string | null }
>

type ChatState = {
	chats: ChatSummaryDto[]
	messagesByConversation: MessagesByConversation
	membersByConversation: MembersByConversation
	paginationByConversation: PaginationByConversation
	activeConversationId: string | null
	isLoadingChats: boolean
	isLoadingMessages: boolean
	isLoadingMembers: boolean
	isSendingMessage: boolean
	totalUnreadCount: number
}

const initialState: ChatState = {
	chats: [],
	messagesByConversation: {},
	membersByConversation: {},
	paginationByConversation: {},
	activeConversationId: null,
	isLoadingChats: false,
	isLoadingMessages: false,
	isLoadingMembers: false,
	isSendingMessage: false,
	totalUnreadCount: 0
}

function recountUnreadCount(chats: ChatSummaryDto[]) {
	return chats.reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0)
}

const chatSlice = createSlice({
	name: 'chat',
	initialState,
	reducers: {
		setChats: (state, action: PayloadAction<ChatSummaryDto[]>) => {
			state.chats = action.payload
			state.totalUnreadCount = recountUnreadCount(action.payload)
		},
		upsertChat: (state, action: PayloadAction<ChatSummaryDto>) => {
			const existing = state.chats.find(item => item.id === action.payload.id)

			if (existing) {
				state.chats = state.chats.map(item =>
					item.id === action.payload.id ? { ...item, ...action.payload } : item
				)
			} else {
				state.chats = [action.payload, ...state.chats]
			}

			state.totalUnreadCount = recountUnreadCount(state.chats)
		},
		setActiveConversation: (state, action: PayloadAction<string | null>) => {
			state.activeConversationId = action.payload
		},
		setMessages: (
			state,
			action: PayloadAction<{
				conversationId: string
				messages: ChatMessageDto[]
			}>
		) => {
			const { conversationId, messages } = action.payload
			state.messagesByConversation[conversationId] = normalizeMessages(messages)
		},
		appendMessages: (
			state,
			action: PayloadAction<{
				conversationId: string
				messages: ChatMessageDto[]
				prepend?: boolean
			}>
		) => {
			const { conversationId, messages, prepend = false } = action.payload
			const existing = state.messagesByConversation[conversationId] ?? []
			const merged = prepend
				? normalizeMessages([...messages, ...existing])
				: normalizeMessages([...existing, ...messages])
			state.messagesByConversation[conversationId] = merged
		},
		appendMessage: (state, action: PayloadAction<ChatMessageDto>) => {
			const message = action.payload
			const existing =
				state.messagesByConversation[message.conversationId] ?? []
			state.messagesByConversation[message.conversationId] =
				appendMessageToEnd(existing, message)
		},
		replaceMessage: (
			state,
			action: PayloadAction<{
				conversationId: string
				temporaryId: string
				message: ChatMessageDto
			}>
		) => {
			const { conversationId, temporaryId, message } = action.payload
			const existing = state.messagesByConversation[conversationId] ?? []
			const temporaryMessage = existing.find(item => item.id === temporaryId)
			const confirmedMessage = temporaryMessage
				? { ...message, createdAt: temporaryMessage.createdAt }
				: message
			const temporaryIndex = existing.findIndex(item => item.id === temporaryId)
			const next = existing.filter(
				item => item.id !== temporaryId && item.id !== message.id
			)
			next.splice(
				temporaryIndex >= 0 ? Math.min(temporaryIndex, next.length) : next.length,
				0,
				confirmedMessage
			)
			state.messagesByConversation[conversationId] = next
		},
		removeMessage: (
			state,
			action: PayloadAction<{ conversationId: string; messageId: string }>
		) => {
			const { conversationId, messageId } = action.payload
			state.messagesByConversation[conversationId] = (
				state.messagesByConversation[conversationId] ?? []
			).filter(item => item.id !== messageId)
		},
		markMessageDeleted: (
			state,
			action: PayloadAction<{ conversationId: string; messageId: string }>
		) => {
			const { conversationId, messageId } = action.payload
			state.messagesByConversation[conversationId] = (
				state.messagesByConversation[conversationId] ?? []
			).map(message =>
				message.id === messageId
					? { ...message, text: null, deleted: true, attachments: [] }
					: message
			)
		},
		setMembers: (
			state,
			action: PayloadAction<{
				conversationId: string
				members: ChatMemberDto[]
			}>
		) => {
			state.membersByConversation[action.payload.conversationId] =
				action.payload.members
		},
		setLoadingChats: (state, action: PayloadAction<boolean>) => {
			state.isLoadingChats = action.payload
		},
		setLoadingMessages: (state, action: PayloadAction<boolean>) => {
			state.isLoadingMessages = action.payload
		},
		setLoadingMembers: (state, action: PayloadAction<boolean>) => {
			state.isLoadingMembers = action.payload
		},
		setSendingMessage: (state, action: PayloadAction<boolean>) => {
			state.isSendingMessage = action.payload
		},
		setPagination: (
			state,
			action: PayloadAction<{
				conversationId: string
				hasMore: boolean
				nextBefore: string | null
			}>
		) => {
			state.paginationByConversation[action.payload.conversationId] = {
				hasMore: action.payload.hasMore,
				nextBefore: action.payload.nextBefore
			}
		},
		updateChatTitle: (
			state,
			action: PayloadAction<{ conversationId: string; title: string }>
		) => {
			state.chats = state.chats.map(chat =>
				chat.id === action.payload.conversationId
					? { ...chat, title: action.payload.title }
					: chat
			)
			state.totalUnreadCount = recountUnreadCount(state.chats)
		},
		markChatRead: (state, action: PayloadAction<string>) => {
			state.chats = state.chats.map(chat =>
				chat.id === action.payload ? { ...chat, unreadCount: 0 } : chat
			)
			state.totalUnreadCount = recountUnreadCount(state.chats)
		},
		incrementChatUnread: (state, action: PayloadAction<string>) => {
			state.chats = state.chats.map(chat =>
				chat.id === action.payload
					? { ...chat, unreadCount: (chat.unreadCount ?? 0) + 1 }
					: chat
			)
			state.totalUnreadCount = recountUnreadCount(state.chats)
		},
		receiveIncomingMessage: (
			state,
			action: PayloadAction<{
				message: ChatMessageDto
				isConversationOpen: boolean
			}>
		) => {
			const { message, isConversationOpen } = action.payload
			const conversationId = message.conversationId
			const messages = state.messagesByConversation[conversationId] ?? []
			const isNewMessage = !messages.some(item => item.id === message.id)

			if (isNewMessage) {
				state.messagesByConversation[conversationId] =
					appendMessageToEnd(messages, message)
			}

			const chat = state.chats.find(item => item.id === conversationId)
			if (chat) {
				chat.lastMessage = message.text ?? '📎'
				chat.lastMessageAt = message.createdAt
				if (isConversationOpen) chat.unreadCount = 0
				else if (isNewMessage) chat.unreadCount = (chat.unreadCount ?? 0) + 1
			} else {
				state.chats.unshift({
					id: conversationId,
					type: 'DIRECT',
					title: message.senderName || '—',
					lastMessage: message.text ?? '📎',
					lastMessageAt: message.createdAt,
					unreadCount: isConversationOpen ? 0 : 1
				})
			}

			state.totalUnreadCount = recountUnreadCount(state.chats)
		},
		applyRealtimeEvent: (state, action: PayloadAction<ChatRealtimeEvent>) => {
			const event = action.payload

			if (event.type === 'MESSAGE_CREATED' && event.message) {
				const message = event.message
				const existing =
					state.messagesByConversation[message.conversationId] ?? []
				const exists = existing.some(item => item.id === message.id)
				if (!exists) {
					state.messagesByConversation[message.conversationId] =
						appendMessageToEnd(existing, message)
				}

				const existingChat = state.chats.find(
					chat => chat.id === message.conversationId
				)
				if (existingChat) {
					state.chats = state.chats.map(chat =>
						chat.id === message.conversationId
							? {
									...chat,
									lastMessage: message.text ?? '📎',
									lastMessageAt: message.createdAt,
									unreadCount:
										chat.id === state.activeConversationId
											? 0
											: Math.max(chat.unreadCount, 0)
								}
							: chat
					)
				} else {
					state.chats = [
						{
							id: message.conversationId,
							type: 'DIRECT',
							title: message.senderName,
							lastMessage: message.text ?? '📎',
							lastMessageAt: message.createdAt,
							unreadCount: 0
						},
						...state.chats
					]
				}

				state.totalUnreadCount = recountUnreadCount(state.chats)
			}

			if (event.type === 'CHAT_UPDATED') {
				const existing = state.chats.find(
					chat => chat.id === event.conversationId
				)
				if (existing) {
					state.chats = state.chats.map(chat =>
						chat.id === event.conversationId ? { ...chat } : chat
					)
				}
			}
		}
	}
})

export const {
	setChats,
	upsertChat,
	setActiveConversation,
	setMessages,
	appendMessages,
	appendMessage,
	replaceMessage,
	removeMessage,
	markMessageDeleted,
	setMembers,
	setLoadingChats,
	setLoadingMessages,
	setLoadingMembers,
	setSendingMessage,
	setPagination,
	updateChatTitle,
	markChatRead,
	incrementChatUnread,
	receiveIncomingMessage,
	applyRealtimeEvent
} = chatSlice.actions

export default chatSlice.reducer
