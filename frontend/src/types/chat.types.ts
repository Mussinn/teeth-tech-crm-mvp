export type ChatType = 'DIRECT' | 'GROUP'
export type ChatMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ChatRealtimeEventType =
	| 'MESSAGE_CREATED'
	| 'MESSAGES_READ'
	| 'CHAT_UPDATED'

export type ChatSummaryDto = {
	id: string
	type: ChatType
	title: string
	lastMessage: string | null
	lastMessageAt: string | null
	unreadCount: number
}

export type ChatMemberDto = {
	userId: string
	name: string
	role: ChatMemberRole
	joinedAt: string
}

export type ChatAttachmentDto = {
	id: string
	fileName: string
	contentType: string
	fileSize: number
}

export type ChatMessageDto = {
	id: string
	conversationId: string
	senderId: string
	senderName: string
	text: string | null
	replyToId: string | null
	createdAt: string
	editedAt: string | null
	deleted: boolean
	attachments: ChatAttachmentDto[]
}

export type ChatMessagesPageDto = {
	content: ChatMessageDto[]
	hasMore: boolean
	nextBefore: string | null
}

export type ChatCreateDirectRequest = {
	userId: string
}

export type ChatCreateGroupRequest = {
	title: string
	memberIds: string[]
}

export type ChatAddMembersRequest = {
	userIds: string[]
}

export type ChatRenameGroupRequest = {
	title: string
}

export type ChatMessagePayload = {
	text: string
	replyToId?: string | null
}

export type ChatAttachmentUrlDto = {
	url: string
	expiresInSeconds: number
}

export type ChatRealtimeEvent = {
	type: ChatRealtimeEventType
	conversationId: string
	message?: ChatMessageDto | null
	userId?: string | null
	occurredAt?: string
}
