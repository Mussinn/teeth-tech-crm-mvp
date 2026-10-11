import type { ChatMessageDto, ChatSummaryDto } from '@/src/types/chat.types'

export function formatChatTime(value: string | null | undefined, locale = 'en-US') {
	if (!value) return ''

	const date = new Date(value)

	if (Number.isNaN(date.getTime())) return ''

	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	}).format(date)
}

export function formatChatDateLabel(
	value: string | null | undefined,
	locale = 'en-US',
	labels = {today: 'Today', yesterday: 'Yesterday'}
) {
	if (!value) return ''

	const date = new Date(value)

	if (Number.isNaN(date.getTime())) return ''

	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
	const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)

	if (diffDays <= 0) return labels.today
	if (diffDays === 1) return labels.yesterday

	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(date)
}

export function getInitials(name?: string | null) {
	if (!name) return '??'

	const parts = name.split(/\s+/u).filter(Boolean)

	if (parts.length === 0) return '??'
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

	return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function formatFileSize(size: number) {
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function normalizeMessages(messages: ChatMessageDto[]) {
	const deduped = messages.reduce<ChatMessageDto[]>((acc, message) => {
		if (acc.some(item => item.id === message.id)) return acc
		acc.push(message)
		return acc
	}, [])

	return deduped.sort(
		(left, right) =>
			new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
	)
}

/**
 * Realtime and mutation responses represent messages that have just arrived.
 * Keep them at the end of the visible timeline instead of sorting again by a
 * server timestamp, which may use a different timezone representation.
 */
export function appendMessageToEnd(
	messages: ChatMessageDto[],
	message: ChatMessageDto
) {
	if (messages.some(item => item.id === message.id)) return messages
	return [...messages, message]
}

export function mergeChatSummaries(
	base: ChatSummaryDto[] | undefined,
	overrides: Record<string, Partial<ChatSummaryDto>>
) {
	if (!base) return []

	return base.map(chat => ({
		...chat,
		...overrides[chat.id]
	}))
}

export function sortByLastMessageAt(chats: ChatSummaryDto[]) {
	return [...chats].sort((left, right) => {
		const leftTime = left.lastMessageAt
			? new Date(left.lastMessageAt).getTime()
			: 0
		const rightTime = right.lastMessageAt
			? new Date(right.lastMessageAt).getTime()
			: 0
		return rightTime - leftTime
	})
}

export function getReplyPreview(
	messages: ChatMessageDto[],
	replyToId?: string | null
) {
	if (!replyToId) return null
	return messages.find(message => message.id === replyToId) ?? null
}
