'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useCallback,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode
} from 'react'
import { useDispatch, useSelector } from 'react-redux'

import ErrorState from '@/src/components/ui/ErrorState'
import Modal from '@/src/components/ui/Modal'
import ConfirmDialog from '@/src/components/ui/ConfirmDialog'
import {
	appendMessage,
	appendMessages,
	markMessageDeleted,
	removeMessage,
	replaceMessage,
	setActiveConversation,
	setChats,
	setLoadingChats,
	setLoadingMembers,
	setLoadingMessages,
	setMembers,
	setMessages,
	setPagination,
	setSendingMessage,
	updateChatTitle
} from '@/src/features/chat/chatSlice'
import { useNotifications } from '@/src/features/notifications/useNotifications'
import { RootState } from '@/src/lib/store'
import { useAppLocale } from '@/src/i18n/provider'
import {
	useAddChatMembersMutation,
	useCreateDirectChatMutation,
	useCreateGroupChatMutation,
	useDeleteChatMessageMutation,
	useGetChatsQuery,
	useMarkChatReadMutation,
	useRemoveChatMemberMutation,
	useRenameGroupChatMutation,
	useSendTextMessageMutation,
	useUploadChatFileMutation
} from '@/src/services/api/chatApi'
import { useGetUsersQuery } from '@/src/services/api/usersApi'
import {
	getChatRealtimeStatus,
} from '@/src/services/chatRealtimeService'
import type {
	ChatMemberDto,
	ChatMessageDto
} from '@/src/types/chat.types'
import {
	formatChatTime,
	formatFileSize,
	getInitials,
	getReplyPreview
} from '@/src/utils/chatUtils'
import { createClientId } from '@/src/utils/clientId'

type MessageContextMenuState = {
	messageId: string
	left: number
	top: number
}

const CONTEXT_MENU_WIDTH = 224
const CONTEXT_MENU_HEIGHT = 196
const CONTEXT_MENU_GAP = 8

function ChatIcon({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			{children}
		</svg>
	)
}

const SearchIcon = () => <ChatIcon className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></ChatIcon>
const PlusIcon = () => <ChatIcon className="h-4 w-4"><path d="M12 5v14M5 12h14" /></ChatIcon>
const UsersIcon = () => <ChatIcon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></ChatIcon>
const EditIcon = () => <ChatIcon><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></ChatIcon>
const PaperclipIcon = () => <ChatIcon><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9" /></ChatIcon>
const ReplyIcon = () => <ChatIcon><path d="m9 17-5-5 5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></ChatIcon>
const SendIcon = () => <ChatIcon><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></ChatIcon>
const BackIcon = () => <ChatIcon><path d="m15 18-6-6 6-6" /></ChatIcon>
const CloseIcon = () => <ChatIcon><path d="M18 6 6 18M6 6l12 12" /></ChatIcon>
const CheckIcon = () => <ChatIcon className="h-4 w-4"><path d="m20 6-11 11-5-5" /></ChatIcon>

export default function ChatPage() {
	const t = useTranslations('chat')
	const { locale } = useAppLocale()
	const router = useRouter()
	const params = useParams<{ conversationId?: string }>()
	const dispatch = useDispatch()
	const { id: currentUserId, name: currentUserName } = useSelector(
		(state: RootState) => state.auth
	)
	const {
		chats,
		activeConversationId,
		messagesByConversation,
		membersByConversation,
		paginationByConversation,
		isLoadingMessages,
		isSendingMessage
	} = useSelector((state: RootState) => state.chat)
	const [search, setSearch] = useState('')
	const [composer, setComposer] = useState('')
	const [replyToId, setReplyToId] = useState<string | null>(null)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [isCreateDirectOpen, setIsCreateDirectOpen] = useState(false)
	const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
	const [isMembersOpen, setIsMembersOpen] = useState(false)
	const [groupTitle, setGroupTitle] = useState('')
	const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
	const [memberSearch, setMemberSearch] = useState('')
	const [isRenaming, setIsRenaming] = useState(false)
	const [newTitle, setNewTitle] = useState('')
	const [uploadError, setUploadError] = useState<string | null>(null)
	const [sendError, setSendError] = useState<string | null>(null)
	const [messageContextMenu, setMessageContextMenu] =
		useState<MessageContextMenuState | null>(null)
	const [forwardMessageId, setForwardMessageId] = useState<string | null>(null)
	const [forwardSearch, setForwardSearch] = useState('')
	const [isForwarding, setIsForwarding] = useState(false)
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
	const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
	const [messageToDelete, setMessageToDelete] = useState<ChatMessageDto | null>(null)
	const messageListRef = useRef<HTMLDivElement | null>(null)
	const composerRef = useRef<HTMLTextAreaElement | null>(null)
	const contextMenuRef = useRef<HTMLDivElement | null>(null)
	const shouldLoadMoreRef = useRef(false)
	const isNearBottomRef = useRef(true)
	const previousConversationRef = useRef<string | null>(null)
	const previousLastMessageIdRef = useRef<string | null>(null)
	const prependScrollSnapshotRef = useRef<{
		conversationId: string
		scrollHeight: number
		scrollTop: number
	} | null>(null)
	const { data: users = [], error: usersError } = useGetUsersQuery()
	const {
		data: chatList = [],
		isLoading: isChatsLoading,
		error: chatsError,
		refetch: refetchChats
	} = useGetChatsQuery(undefined, { refetchOnMountOrArgChange: true })
	const [createDirectChat] = useCreateDirectChatMutation()
	const [createGroupChat, { isLoading: isCreatingGroup }] =
		useCreateGroupChatMutation()
	const [sendTextMessage, { isLoading: isSendingRest }] =
		useSendTextMessageMutation()
	const [deleteChatMessage] = useDeleteChatMessageMutation()
	const [uploadChatFile, { isLoading: isUploadingFile }] =
		useUploadChatFileMutation()
	const [markChatRead] = useMarkChatReadMutation()
	const [addChatMembers] = useAddChatMembersMutation()
	const [removeChatMember] = useRemoveChatMemberMutation()
	const [renameGroupChat] = useRenameGroupChatMutation()
	const { notifyError, notifySuccess } = useNotifications()

	const activeConversation =
		chats.find(chat => chat.id === activeConversationId) ?? null
	const activeMessages = activeConversationId
		? (messagesByConversation[activeConversationId] ?? [])
		: []
	const sortedMessages = activeMessages
	const activeMembers = useMemo(
		() => activeConversationId
			? (membersByConversation[activeConversationId] ?? [])
			: [],
		[activeConversationId, membersByConversation]
	)
	const activePagination = activeConversationId
		? paginationByConversation[activeConversationId]
		: undefined
	const filteredChats = useMemo(() => {
		const term = search.trim().toLocaleLowerCase(locale)
		return [...chats]
			.sort(
				(left, right) =>
					Date.parse(right.lastMessageAt ?? '') -
					Date.parse(left.lastMessageAt ?? '')
			)
			.filter(chat => !term || chat.title.toLocaleLowerCase(locale).includes(term))
	}, [chats, locale, search])
	const forwardChats = useMemo(() => {
		const term = forwardSearch.trim().toLocaleLowerCase(locale)
		return [...chats]
			.sort(
				(left, right) =>
					Date.parse(right.lastMessageAt ?? '') -
					Date.parse(left.lastMessageAt ?? '')
			)
			.filter(chat => !term || chat.title.toLocaleLowerCase(locale).includes(term))
	}, [chats, forwardSearch, locale])
	const contextMessage = messageContextMenu
		? activeMessages.find(message => message.id === messageContextMenu.messageId) ??
			null
		: null
	const forwardMessage = forwardMessageId
		? activeMessages.find(message => message.id === forwardMessageId) ?? null
		: null

	const scrollToBottom = () => {
		const el = messageListRef.current
		if (!el) return
		el.scrollTop = el.scrollHeight
	}

	const filteredUsers = useMemo(() => {
		const term = memberSearch.trim().toLowerCase()
		return users.filter(user => {
			const matches = [user.fullName, user.name, user.email]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
			const isCurrent = currentUserId && user.id === currentUserId
			return !isCurrent && (!term || matches.includes(term))
		})
	}, [currentUserId, memberSearch, users])

	const currentUserCanManageGroup = useMemo(() => {
		const member = activeMembers.find(item => item.userId === currentUserId)
		return member?.role === 'OWNER' || member?.role === 'ADMIN'
	}, [activeMembers, currentUserId])

	const loadMembers = useCallback(async (conversationId: string) => {
		if (!conversationId) return
		dispatch(setLoadingMembers(true))
		try {
			const result = await fetch(
				`/api/backend/chats/${conversationId}/members`,
				{ credentials: 'same-origin' }
			)
			if (result.ok) {
				const members = (await result.json()) as ChatMemberDto[]
				dispatch(setMembers({ conversationId, members }))
			}
		} catch {
			notifyError(t('errors.members'))
		} finally {
			dispatch(setLoadingMembers(false))
		}
	}, [dispatch, notifyError, t])

	useEffect(() => {
		dispatch(setLoadingChats(isChatsLoading))
	}, [dispatch, isChatsLoading])

	useEffect(() => {
		if (chatList.length) {
			dispatch(setChats(chatList))
		}
	}, [chatList, dispatch])

	useEffect(() => {
		const conversationId = params.conversationId
		if (conversationId) {
			dispatch(setActiveConversation(conversationId))
			const hasLoadedMessages = Object.prototype.hasOwnProperty.call(
				paginationByConversation,
				conversationId
			)
			if (!hasLoadedMessages) {
				const loadInitialMessages = async () => {
					dispatch(setLoadingMessages(true))
					try {
						const response = await fetch(
							`/api/backend/chats/${conversationId}/messages?size=50`,
							{ credentials: 'same-origin' }
						)
						if (!response.ok) throw new Error('Failed')
						const page = (await response.json()) as {
							content: ChatMessageDto[]
							hasMore: boolean
							nextBefore: string | null
						}
						dispatch(
							setMessages({
								conversationId,
								messages: page.content
							})
						)
						dispatch(
							setPagination({
								conversationId,
								hasMore: page.hasMore,
								nextBefore: page.nextBefore
							})
						)
						if (page.content.length) {
							setTimeout(() => {
								if (messageListRef.current) {
									messageListRef.current.scrollTop =
										messageListRef.current.scrollHeight
								}
							}, 0)
						}
					} catch {
						notifyError(t('errors.history'))
					} finally {
						dispatch(setLoadingMessages(false))
					}
				}
				void loadInitialMessages()
			}
		} else {
			dispatch(setActiveConversation(null))
		}
	}, [
		dispatch,
		notifyError,
		paginationByConversation,
		params.conversationId,
		t
	])

	useEffect(
		() => () => {
			dispatch(setActiveConversation(null))
		},
		[dispatch]
	)

	useEffect(() => {
		setMessageContextMenu(null)
		setForwardMessageId(null)
		setForwardSearch('')
		isNearBottomRef.current = true
		prependScrollSnapshotRef.current = null
	}, [activeConversationId])

	useEffect(() => {
		if (!messageContextMenu) return

		const closeOnPointerDown = (event: PointerEvent) => {
			if (
				contextMenuRef.current &&
				!contextMenuRef.current.contains(event.target as Node)
			) {
				setMessageContextMenu(null)
			}
		}
		const closeOnEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key === 'Escape') setMessageContextMenu(null)
		}
		const closeOnViewportChange = () => setMessageContextMenu(null)

		document.addEventListener('pointerdown', closeOnPointerDown)
		document.addEventListener('keydown', closeOnEscape)
		window.addEventListener('resize', closeOnViewportChange)
		window.addEventListener('scroll', closeOnViewportChange, true)

		return () => {
			document.removeEventListener('pointerdown', closeOnPointerDown)
			document.removeEventListener('keydown', closeOnEscape)
			window.removeEventListener('resize', closeOnViewportChange)
			window.removeEventListener('scroll', closeOnViewportChange, true)
		}
	}, [messageContextMenu])

	useEffect(() => {
		if (activeConversationId) {
			void loadMembers(activeConversationId)
			void markChatRead(activeConversationId)
		}
	}, [activeConversationId, loadMembers, markChatRead])

	useEffect(() => {
		if (activeConversationId && messageListRef.current) {
			const el = messageListRef.current
			const handler = () => {
				if (
					el.scrollTop < 80 &&
					!shouldLoadMoreRef.current &&
					activePagination?.hasMore
				) {
					shouldLoadMoreRef.current = true
					const loadOlderMessages = async () => {
						try {
							const before = activePagination.nextBefore ?? undefined
							const response = await fetch(
								`/api/backend/chats/${activeConversationId}/messages?before=${encodeURIComponent(before ?? '')}&size=50`,
								{ credentials: 'same-origin' }
							)
							if (!response.ok) throw new Error('Failed')
							const page = (await response.json()) as {
								content: ChatMessageDto[]
								hasMore: boolean
								nextBefore: string | null
							}
							const currentScroller = messageListRef.current
							if (currentScroller) {
								prependScrollSnapshotRef.current = {
									conversationId: activeConversationId,
									scrollHeight: currentScroller.scrollHeight,
									scrollTop: currentScroller.scrollTop
								}
							}
							dispatch(
								appendMessages({
									conversationId: activeConversationId,
									messages: page.content,
									prepend: true
								})
							)
							dispatch(
								setPagination({
									conversationId: activeConversationId,
									hasMore: page.hasMore,
									nextBefore: page.nextBefore
								})
							)
						} catch {
							notifyError(t('errors.older'))
						} finally {
							shouldLoadMoreRef.current = false
						}
					}
					void loadOlderMessages()
				}

				const position = el.scrollHeight - el.scrollTop - el.clientHeight
				isNearBottomRef.current = position < 80
			}

			const initialPosition = el.scrollHeight - el.scrollTop - el.clientHeight
			isNearBottomRef.current = initialPosition < 80
			el.addEventListener('scroll', handler)
			return () => el.removeEventListener('scroll', handler)
		}
	}, [activeConversationId, activePagination, dispatch, notifyError, t])

	useLayoutEffect(() => {
		if (!activeConversationId || !messageListRef.current) return
		if (sortedMessages.length === 0) return

		const scroller = messageListRef.current
		const prependSnapshot = prependScrollSnapshotRef.current
		if (prependSnapshot?.conversationId === activeConversationId) {
			const addedHeight = scroller.scrollHeight - prependSnapshot.scrollHeight
			scroller.scrollTop = prependSnapshot.scrollTop + addedHeight
			prependScrollSnapshotRef.current = null
			return
		}

		const lastMessage = sortedMessages[sortedMessages.length - 1]
		const conversationChanged =
			previousConversationRef.current !== activeConversationId
		const lastMessageChanged =
			previousLastMessageIdRef.current !== lastMessage.id

		if (
			conversationChanged ||
			(lastMessageChanged &&
				(isNearBottomRef.current || lastMessage.senderId === currentUserId))
		) {
			scrollToBottom()
		}

		previousConversationRef.current = activeConversationId
		previousLastMessageIdRef.current = lastMessage.id
	}, [activeConversationId, sortedMessages, currentUserId])

	const openDirectChat = async (userId: string) => {
		if (!userId || userId === currentUserId) return
		try {
			const chat = await createDirectChat({ userId }).unwrap()
			router.push(`/chats/${chat.id}`)
			setIsCreateDirectOpen(false)
			notifySuccess(t('success.opened'))
		} catch {
			notifyError(t('errors.open'))
		}
	}

	const handleCreateGroup = async () => {
		if (!groupTitle.trim()) {
			notifyError(t('errors.groupTitle'))
			return
		}
		if (selectedMemberIds.length === 0) {
			notifyError(t('errors.groupMember'))
			return
		}
		try {
			const created = await createGroupChat({
				title: groupTitle.trim(),
				memberIds: selectedMemberIds
			}).unwrap()
			router.push(`/chats/${created.id}`)
			setIsCreateGroupOpen(false)
			setGroupTitle('')
			setSelectedMemberIds([])
			notifySuccess(t('success.groupCreated'))
		} catch {
			notifyError(t('errors.createGroup'))
		}
	}

	const handleSendMessage = async () => {
		const text = composer.trim()
		if (!activeConversationId || !text) return
		if (isSendingMessage || isSendingRest || isUploadingFile) return
		const conversationId = activeConversationId
		const originalReplyToId = replyToId
		const temporaryId = createClientId('pending')
		const optimisticMessage: ChatMessageDto = {
			id: temporaryId,
			conversationId,
			senderId: currentUserId ?? '',
			senderName: currentUserName ?? t('you'),
			text,
			replyToId: originalReplyToId,
			createdAt: new Date().toISOString(),
			editedAt: null,
			deleted: false,
			attachments: []
		}
		setSendError(null)
		dispatch(setSendingMessage(true))
		dispatch(appendMessage(optimisticMessage))
		setComposer('')
		setReplyToId(null)
		try {
			const payload = { text, replyToId: originalReplyToId }
			const created = await sendTextMessage({
				conversationId,
				body: payload
			}).unwrap()
			dispatch(replaceMessage({ conversationId, temporaryId, message: created }))
		} catch {
			dispatch(removeMessage({ conversationId, messageId: temporaryId }))
			setComposer(text)
			setReplyToId(originalReplyToId)
			setSendError(t('errors.send'))
		} finally {
			dispatch(setSendingMessage(false))
		}
	}

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0]
		if (!file || !activeConversationId) return
		if (file.size > 25 * 1024 * 1024) {
			setUploadError(t('errors.fileSize'))
			return
		}
		setSelectedFile(file)
		setUploadError(null)
	}

	const handleUploadFile = async () => {
		if (!activeConversationId || !selectedFile) return
		dispatch(setSendingMessage(true))
		const formData = new FormData()
		formData.append('file', selectedFile)
		try {
			const created = await uploadChatFile({
				conversationId: activeConversationId,
				formData
			}).unwrap()
			dispatch(appendMessage(created))
			setSelectedFile(null)
			dispatch(setSendingMessage(false))
		} catch {
			setUploadError(t('errors.sendFile'))
			dispatch(setSendingMessage(false))
		}
	}

	const handleAddMembers = async () => {
		if (!activeConversationId) return
		try {
			await addChatMembers({
				conversationId: activeConversationId,
				body: { userIds: selectedMemberIds }
			}).unwrap()
			await loadMembers(activeConversationId)
			notifySuccess(t('success.membersAdded'))
			setIsMembersOpen(false)
			setSelectedMemberIds([])
		} catch {
			notifyError(t('errors.addMembers'))
		}
	}

	const handleRemoveMember = async (memberId: string) => {
		if (!activeConversationId) return
		try {
			await removeChatMember({
				conversationId: activeConversationId,
				memberId
			}).unwrap()
			await loadMembers(activeConversationId)
			notifySuccess(t('success.memberRemoved'))
			setMemberToRemove(null)
		} catch {
			notifyError(t('errors.removeMember'))
		}
	}

	const handleRenameGroup = async () => {
		if (!activeConversationId || !newTitle.trim()) return
		try {
			const updated = await renameGroupChat({
				conversationId: activeConversationId,
				body: { title: newTitle.trim() }
			}).unwrap()
			dispatch(
				updateChatTitle({
					conversationId: activeConversationId,
					title: updated.title
				})
			)
			notifySuccess(t('success.renamed'))
			setIsRenaming(false)
		} catch {
			notifyError(t('errors.rename'))
		}
	}

	const openMessageContextMenu = (
		message: ChatMessageDto,
		clientX: number,
		clientY: number
	) => {
		if (message.deleted || message.id.startsWith('pending-')) return

		const left = Math.max(
			CONTEXT_MENU_GAP,
			Math.min(
				clientX,
				window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_GAP
			)
		)
		const top = Math.max(
			CONTEXT_MENU_GAP,
			Math.min(
				clientY,
				window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_GAP
			)
		)

		setMessageContextMenu({ messageId: message.id, left, top })
	}

	const handleMessageContextMenu = (
		event: MouseEvent<HTMLDivElement>,
		message: ChatMessageDto
	) => {
		event.preventDefault()
		openMessageContextMenu(message, event.clientX, event.clientY)
	}

	const handleMessageContextKeyDown = (
		event: KeyboardEvent<HTMLDivElement>,
		message: ChatMessageDto
	) => {
		if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) {
			return
		}

		event.preventDefault()
		const rect = event.currentTarget.getBoundingClientRect()
		openMessageContextMenu(message, rect.left + rect.width / 2, rect.top + 24)
	}

	const handleReplyToMessage = (message: ChatMessageDto) => {
		setReplyToId(message.id)
		setMessageContextMenu(null)
		requestAnimationFrame(() => composerRef.current?.focus())
	}

	const handleCopyMessage = async (message: ChatMessageDto) => {
		const text =
			message.text?.trim() ||
			message.attachments.map(attachment => attachment.fileName).join('\n')
		if (!text) return

		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text)
			} else {
				const textarea = document.createElement('textarea')
				textarea.value = text
				textarea.style.position = 'fixed'
				textarea.style.opacity = '0'
				document.body.appendChild(textarea)
				textarea.select()
				const copied = document.execCommand('copy')
				textarea.remove()
				if (!copied) throw new Error('Copy failed')
			}
			notifySuccess(t('success.copied'))
		} catch {
			notifyError(t('errors.copy'))
		} finally {
			setMessageContextMenu(null)
		}
	}

	const openForwardDialog = (message: ChatMessageDto) => {
		if (!message.text?.trim()) return
		setForwardMessageId(message.id)
		setForwardSearch('')
		setMessageContextMenu(null)
	}

	const handleForwardMessage = async (conversationId: string) => {
		const sourceText = forwardMessage?.text?.trim()
		if (!forwardMessage || !sourceText || isForwarding) return

		setIsForwarding(true)
		try {
			const created = await sendTextMessage({
				conversationId,
				body: {
					text: t('forwardedFrom', {name: forwardMessage.senderName, text: sourceText}),
					replyToId: null
				}
			}).unwrap()
			dispatch(appendMessage(created))
			notifySuccess(t('success.forwarded'))
			setForwardMessageId(null)
			setForwardSearch('')
		} catch {
			notifyError(t('errors.forward'))
		} finally {
			setIsForwarding(false)
		}
	}

	const handleDeleteMessage = async (message: ChatMessageDto) => {
		if (
			!activeConversationId ||
			message.senderId !== currentUserId ||
			deletingMessageId
		) {
			return
		}
		setMessageContextMenu(null)

		setDeletingMessageId(message.id)
		try {
			await deleteChatMessage({
				conversationId: activeConversationId,
				messageId: message.id
			}).unwrap()
			dispatch(
				markMessageDeleted({
					conversationId: activeConversationId,
					messageId: message.id
				})
			)
			if (replyToId === message.id) setReplyToId(null)
			notifySuccess(t('success.deleted'))
			setMessageToDelete(null)
		} catch {
			notifyError(t('errors.delete'))
		} finally {
			setDeletingMessageId(null)
		}
	}

	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

	const renderMessage = (message: ChatMessageDto) => {
		const isMine = message.senderId === currentUserId
		const replyMessage = getReplyPreview(activeMessages, message.replyToId)
		const isAttachmentVisible = message.attachments?.length > 0
		return (
			<div
				key={message.id}
				tabIndex={message.deleted ? -1 : 0}
				onContextMenu={event => handleMessageContextMenu(event, message)}
				onKeyDown={event => handleMessageContextKeyDown(event, message)}
				aria-label={t('messageAria', {name: message.senderName})}
				className={`group flex ${isMine ? 'justify-end' : 'justify-start'} mb-3.5`}
			>
				{!isMine ? (
					<div className="mr-2 mt-auto hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-black text-white shadow-sm sm:flex">
						{getInitials(message.senderName)}
					</div>
				) : null}
				<div
					className={`relative max-w-[88%] px-3.5 py-2.5 shadow-sm transition-all sm:max-w-[72%] ${messageContextMenu?.messageId === message.id ? 'ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-slate-950' : ''} ${isMine ? 'rounded-[18px] rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-500/10' : 'rounded-[18px] rounded-bl-md border border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}
				>
					{!isMine && activeConversation?.type === 'GROUP' ? (
						<div className="mb-1 text-xs font-bold text-violet-600 dark:text-violet-300">
							{message.senderName}
						</div>
					) : null}
					{replyMessage ? (
						<div
							className={`mb-2 rounded-xl border-l-[3px] px-3 py-2 text-sm ${isMine ? 'border-white/50 bg-white/10' : 'border-violet-500 bg-slate-50 dark:bg-slate-900/50'}`}
						>
							↩ {replyMessage.text ?? t('replyToMessage')}
						</div>
					) : null}
					{message.deleted ? (
						<div className="text-sm italic opacity-70">{t('deletedMessage')}</div>
					) : (
						<>
							{message.text ? (
								<div className="whitespace-pre-wrap text-sm leading-6">
									{message.text}
								</div>
							) : null}
							{isAttachmentVisible ? (
								<div className="mt-2 space-y-2">
									{message.attachments.map(attachment => {
										const isImage = attachment.contentType.startsWith('image/')
										return (
											<div
												key={attachment.id}
												className="rounded-xl border border-slate-200 bg-slate-50 p-2"
											>
										{isImage ? (
											<div className="flex items-center gap-2 text-sm">
												<span className="rounded-lg bg-slate-200 px-2 py-1">🖼️</span>
												<span>{attachment.fileName}</span>
											</div>
										) : (
													<div className="flex items-center gap-2 text-sm">
														<span className="rounded-lg bg-slate-200 px-2 py-1">
															📎
														</span>
														<span>{attachment.fileName}</span>
													</div>
												)}
												<div className="mt-2 flex items-center justify-between text-xs text-slate-500">
													<span>{attachment.fileName}</span>
													<span>{formatFileSize(attachment.fileSize)}</span>
												</div>
											</div>
										)
									})}
								</div>
							) : null}
						</>
					)}
					<div
					className={`mt-1 flex justify-end text-[10px] font-medium ${isMine ? 'text-violet-100' : 'text-slate-400'}`}
					>
						{formatChatTime(message.createdAt, locale)}{isMine && !message.deleted ? '  ·  ✓✓' : ''}
					</div>
				</div>
			</div>
		)
	}

	if (usersError || chatsError) {
		return (
			<ErrorState
				title={t('unavailable')}
				onRetry={() => void refetchChats()}
			>
				<p>
					{t('unavailableHint')}
				</p>
			</ErrorState>
		)
	}

	return (
		<div className="relative flex h-[calc(100dvh-8.5rem)] min-h-[26rem] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,.4)] dark:border-slate-800 dark:bg-slate-950 sm:min-h-[36rem] lg:flex-row">
			<aside className={`${activeConversation ? 'hidden lg:flex' : 'flex'} w-full flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-[360px] lg:border-b-0 lg:border-r xl:w-[390px]`}>
				<div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{t('title')}</h1>
								<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{chats.reduce((sum, chat) => sum + chat.unreadCount, 0)}</span>
							</div>
							<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
						</div>
						<div className="flex shrink-0 items-center rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
							<button
								type="button"
								onClick={() => setIsCreateDirectOpen(true)}
								title={t('newDirectTitle')}
								className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-xs font-black text-white shadow-sm shadow-violet-500/20 transition hover:-translate-y-0.5"
							>
								<PlusIcon />
								<span>{t('chat')}</span>
							</button>
							<button
								type="button"
								onClick={() => setIsCreateGroupOpen(true)}
								title={t('createGroup')}
								className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black text-slate-600 transition hover:bg-white hover:text-violet-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-violet-300"
							>
								<UsersIcon />
								<span>{t('group')}</span>
							</button>
						</div>
					</div>
					<label className="mt-4 flex h-11 items-center gap-2.5 rounded-full border border-slate-200 bg-slate-100 px-4 text-slate-400 transition focus-within:border-violet-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-violet-500/10">
						<SearchIcon />
						<input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('searchChats')} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
						<span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold dark:border-slate-700">⌘K</span>
					</label>
				</div>
				<div className="flex-1 overflow-y-auto p-2.5">
					{isChatsLoading ? (
						<div className="space-y-2 p-2">
							{Array.from({ length: 5 }).map((_, index) => (
								<div
									key={index}
									className="h-16 animate-pulse rounded-2xl bg-slate-200"
								/>
							))}
						</div>
					) : filteredChats.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
							{t('noChats')}
						</div>
					) : (
						filteredChats.map(chat => (
							<button
								key={chat.id}
								type="button"
								onClick={() => router.push(`/chats/${chat.id}`)}
								className={`relative mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${activeConversationId === chat.id ? 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
							>
								<div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-black text-white shadow-sm ${chat.type === 'GROUP' ? 'from-fuchsia-500 to-violet-600' : 'from-violet-500 to-indigo-600'}`}>
									{getInitials(chat.title)}
									<span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-emerald-500 dark:border-slate-800" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-bold text-slate-900 dark:text-white">
											{chat.title}
										</p>
										{chat.lastMessageAt ? (
											<span className="text-[11px] text-slate-400">
												{formatChatTime(chat.lastMessageAt, locale)}
											</span>
										) : null}
									</div>
									<p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
										{chat.lastMessage ?? t('startDialogue')}
									</p>
								</div>
								{chat.unreadCount > 0 ? (
									<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-black text-white shadow-sm shadow-violet-500/30">
										{chat.unreadCount}
									</span>
								) : null}
							</button>
						))
					)}
				</div>
			</aside>
			<section className={`${activeConversation ? 'flex' : 'hidden lg:flex'} relative min-w-0 flex-1 flex-col bg-white dark:bg-slate-950`}>
				{activeConversation ? (
					<>
						<header className="flex min-h-[70px] items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 sm:px-5">
							<div className="flex items-center gap-3">
								{isMobile ? (
									<button type="button" onClick={() => router.push('/chats')} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={t('backToChats')}><BackIcon /></button>
								) : null}
								<div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-black text-white shadow-lg shadow-violet-500/20">
									{getInitials(activeConversation.title)}
									<span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500 dark:border-slate-950" />
								</div>
								<div>
									<h2 className="text-base font-black text-slate-950 dark:text-white">
										{activeConversation.title}
									</h2>
									<p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
										<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
										{activeConversation.type === 'GROUP'
											? t('group')
											: t('direct')}{' '}
										· {t(`realtime.${getChatRealtimeStatus()}`)}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{currentUserCanManageGroup ? (
									<button
										type="button"
										onClick={() => setIsMembersOpen(true)}
										className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
									>
										<UsersIcon /><span className="hidden xl:inline">{t('members')}</span>
									</button>
								) : null}
								{activeConversation.type === 'GROUP' ? (
									<button
										type="button"
										onClick={() => {
											setNewTitle(activeConversation.title)
											setIsRenaming(true)
										}}
										className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
									>
										<EditIcon /><span className="hidden xl:inline">{t('rename')}</span>
									</button>
								) : null}
							</div>
						</header>
						<div
							ref={messageListRef}
							className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,.08),transparent_28%),radial-gradient(circle_at_90%_30%,rgba(99,102,241,.06),transparent_25%)] bg-violet-50/40 p-3 dark:bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,.12),transparent_28%)] dark:bg-slate-950 sm:p-5"
						>
							<div className="flex min-h-full flex-col">
							<div className="mt-auto" aria-hidden="true" />
							{isLoadingMessages ? (
								<div className="m-auto rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
									{t('loadingHistory')}
								</div>
							) : sortedMessages.length === 0 ? (
								<div className="m-auto max-w-sm rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
									<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><SendIcon /></div>
									<p className="font-black text-slate-900 dark:text-white">{t('startTalking')}</p>
									<p className="mt-1 text-xs leading-5 text-slate-500">{t('startTalkingHint')}</p>
								</div>
							) : (
								 sortedMessages.map(message => renderMessage(message))
							)}
							</div>
						</div>
						<div className="border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5 sm:py-4">
							{replyToId ? (
								<div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
									<span>
										{t('reply')}:{' '}
										{activeMessages.find(item => item.id === replyToId)?.text ??
											t('messageFallback')}
									</span>
									<button
										type="button"
										onClick={() => setReplyToId(null)}
										className="text-slate-400"
									>
										×
									</button>
								</div>
							) : null}
							{selectedFile ? (
								<div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
									<span>
										{selectedFile.name} · {formatFileSize(selectedFile.size)}
									</span>
									<button
										type="button"
										onClick={() => setSelectedFile(null)}
										className="text-slate-400"
									>
										×
									</button>
								</div>
							) : null}
							<div className="rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-violet-500 dark:focus-within:ring-violet-500/10">
							<textarea
								ref={composerRef}
								value={composer}
								onChange={event => setComposer(event.target.value)}
								onKeyDown={event => {
									if (event.key === 'Enter' && !event.shiftKey) {
										event.preventDefault()
										void handleSendMessage()
									}
								}}
								placeholder={t('writeMessage')}
								className="min-h-[54px] max-h-32 w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
							/>
							<div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-700">
								<div className="flex items-center gap-2">
									<label title={t('attachFile')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-500/15 dark:hover:text-violet-300">
										<PaperclipIcon />
										<input
											type="file"
											className="hidden"
											onChange={handleFileChange}
										/>
									</label>
									<button
										type="button"
										onClick={() =>
											setReplyToId(
												activeMessages[activeMessages.length - 1]?.id ?? null
											)
										}
										className="flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-500/15"
									>
										<ReplyIcon /> {t('reply')}
									</button>
									{selectedFile ? (
										<button
											type="button"
											onClick={() => void handleUploadFile()}
											disabled={isSendingMessage}
											className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
										>
											{t('sendFile')}
										</button>
									) : null}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-xs text-slate-400">
										{composer.trim().length}/4000
									</span>
									<button
										type="button"
										onClick={() => void handleSendMessage()}
										disabled={!composer.trim() || isSendingMessage}
										className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 sm:w-auto sm:px-4"
									>
										<span className="hidden sm:inline">{t('send')}</span><SendIcon />
									</button>
								</div>
							</div>
							</div>
							{sendError ? (
								<div className="mt-2 text-sm text-red-600">{sendError}</div>
							) : null}
							{uploadError ? (
								<div className="mt-2 text-sm text-red-600">{uploadError}</div>
							) : null}
						</div>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(139,92,246,.08),transparent_45%)] p-8 text-sm text-slate-500">
						<div className="max-w-sm text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-2xl shadow-violet-500/25"><SendIcon /></div><h2 className="text-xl font-black text-slate-950 dark:text-white">{t('yourMessages')}</h2><p className="mt-2 leading-6">{t('yourMessagesHint')}</p></div>
					</div>
				)}
			</section>
			{messageContextMenu && contextMessage ? (
				<div
					ref={contextMenuRef}
					role="menu"
					aria-label={t('messageActions')}
					className="fixed z-[70] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-sm text-slate-800 shadow-2xl"
					style={{
						left: messageContextMenu.left,
						top: messageContextMenu.top
					}}
				>
					<button
						type="button"
						role="menuitem"
						onClick={() => handleReplyToMessage(contextMessage)}
						className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
					>
						<span aria-hidden="true">↩</span>
						{t('reply')}
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => openForwardDialog(contextMessage)}
						disabled={!contextMessage.text?.trim()}
						title={
							contextMessage.text?.trim()
								? undefined
								: t('forwardUnavailable')
						}
						className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-slate-100 focus:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
					>
						<span aria-hidden="true">➜</span>
						{t('forward')}
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => void handleCopyMessage(contextMessage)}
						className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
					>
						<span aria-hidden="true">⧉</span>
						{t('copy')}
					</button>
					{contextMessage.senderId === currentUserId ? (
						<>
							<div className="my-1 border-t border-slate-100" />
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setMessageContextMenu(null)
									setMessageToDelete(contextMessage)
								}}
								disabled={deletingMessageId === contextMessage.id}
								className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none disabled:opacity-50"
							>
								<span aria-hidden="true">⌫</span>
								{t('delete')}
							</button>
						</>
					) : null}
				</div>
			) : null}
			{forwardMessage ? (
				<Modal contentClassName="max-w-lg overflow-hidden p-0">
					<div className="p-5 sm:p-6">
						<div className="flex items-center justify-between gap-4">
							<div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><SendIcon /></div><h3 className="text-xl font-black text-slate-950 dark:text-white">{t('forwardTitle')}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('forwardHint')}</p></div>
							<button
								type="button"
								onClick={() => {
									setForwardMessageId(null)
									setForwardSearch('')
								}}
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
								aria-label={t('close')}
							>
								<CloseIcon />
							</button>
						</div>
						<div className="mt-5 line-clamp-3 rounded-2xl border-l-4 border-violet-500 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
							{forwardMessage.text}
						</div>
						<input
							value={forwardSearch}
							onChange={event => setForwardSearch(event.target.value)}
							placeholder={t('findChat')}
							className="mt-4 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-violet-500/10"
							autoFocus
						/>
						<div className="mt-3 max-h-72 space-y-2 overflow-auto">
							{forwardChats.length ? (
								forwardChats.map(chat => (
									<button
										key={chat.id}
										type="button"
										onClick={() => void handleForwardMessage(chat.id)}
										disabled={isForwarding}
										className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left text-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 dark:border-slate-700 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10"
									>
										<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-black text-white">{getInitials(chat.title)}</span><span className="min-w-0 flex-1 truncate font-bold text-slate-800 dark:text-white">{chat.title}</span>
										<span className="text-xs text-slate-400">
											{chat.type === 'GROUP' ? t('group') : t('direct')}
										</span>
									</button>
								))
							) : (
								<p className="py-6 text-center text-sm text-slate-500">
									{t('chatsNotFound')}
								</p>
							)}
						</div>
					</div>
				</Modal>
			) : null}
			{isCreateDirectOpen ? (
				<Modal contentClassName="max-w-lg overflow-hidden p-0">
					<div className="p-5 sm:p-6">
						<div className="flex items-center justify-between">
							<div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><PlusIcon /></div><h3 className="text-xl font-black text-slate-950 dark:text-white">{t('newDirectTitle')}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('newDirectHint')}</p></div>
							<button
								type="button"
								onClick={() => setIsCreateDirectOpen(false)}
								className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
							>
								<CloseIcon />
							</button>
						</div>
						<input
							value={memberSearch}
							onChange={event => setMemberSearch(event.target.value)}
							placeholder={t('searchEmployees')}
							className="mt-5 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-violet-500/10"
						/>
						<div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
							{filteredUsers.map(user => (
								<button
									key={user.id}
									type="button"
									onClick={() => void openDirectChat(user.id)}
									className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left text-sm transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-violet-500/10"
								>
									<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-black text-white">{getInitials(user.fullName || user.name || 'U')}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-900 dark:text-white">{user.fullName || user.name}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 group-hover:bg-violet-600 group-hover:text-white dark:bg-slate-800">{t('open')}</span>
								</button>
							))}
						</div>
					</div>
				</Modal>
			) : null}
			{isCreateGroupOpen ? (
				<Modal contentClassName="max-w-5xl overflow-hidden p-0">
					<div className="p-5 sm:p-7">
						<div className="flex items-start justify-between gap-4">
							<div className="flex min-w-0 items-center gap-3.5">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
									<UsersIcon />
								</div>
								<div className="min-w-0">
									<h3 className="text-xl font-black text-slate-950 dark:text-white">{t('createGroup')}</h3>
									<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('createGroupHint')}</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setIsCreateGroupOpen(false)}
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
							>
								<CloseIcon />
							</button>
						</div>

						<div className="mt-6 grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] items-stretch gap-4">
							<div className="flex h-[25rem] min-h-0 min-w-0 flex-col rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 sm:p-5">
								<label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
									{t('name')}
									<input
										value={groupTitle}
										onChange={event => setGroupTitle(event.target.value)}
										className="mt-2 h-12 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:text-white dark:focus:ring-violet-500/10"
									/>
								</label>

								<div className="mt-6 flex items-center justify-between">
									<p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('members')}</p>
									<span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
										{selectedMemberIds.length}
									</span>
								</div>

								<div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
									{selectedMemberIds.length === 0 ? (
										<div className="flex h-full min-h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] px-5 text-center text-sm text-slate-400 dark:text-slate-500">
											{t('errors.groupMember')}
										</div>
									) : null}
									{selectedMemberIds.map(id => {
										const selectedUser = users.find(user => user.id === id)
										const selectedUserName = selectedUser?.fullName || selectedUser?.name || t('memberFallback')

										return (
											<div
												key={id}
												className="flex items-center gap-3 rounded-2xl border border-violet-300/70 bg-[var(--app-surface)] px-3 py-2.5 dark:border-violet-500/40"
											>
												<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">
													{getInitials(selectedUserName)}
												</span>
												<span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">
													{selectedUserName}
												</span>
												<button
													type="button"
													onClick={() => setSelectedMemberIds(current => current.filter(memberId => memberId !== id))}
													aria-label={`${t('remove')}: ${selectedUserName}`}
													className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
												>
													<CloseIcon />
												</button>
											</div>
										)
									})}
								</div>
							</div>

							<div className="flex h-[25rem] min-h-0 min-w-0 flex-col rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
								<p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('members')}</p>
								<label className="relative mt-2 block">
									<span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
										<SearchIcon />
									</span>
									<input
										value={memberSearch}
										onChange={event => setMemberSearch(event.target.value)}
										aria-label={t('searchEmployees')}
										className="h-12 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-background)] pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:text-white dark:focus:ring-violet-500/10"
										placeholder={t('searchEmployees')}
									/>
								</label>

								<div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-1 pr-1">
									{filteredUsers.map(user => (
										<button
											key={user.id}
											type="button"
											onClick={() =>
												setSelectedMemberIds(current =>
													current.includes(user.id)
														? current.filter(id => id !== user.id)
														: [...current, user.id]
												)
											}
											className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition ${selectedMemberIds.includes(user.id) ? 'border-violet-400/70 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10' : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-violet-300 hover:bg-violet-50/60 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/5'}`}
										>
											<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white dark:bg-slate-700">
												{getInitials(user.fullName || user.name || 'U')}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate font-bold text-slate-900 dark:text-white">{user.fullName || user.name}</span>
												{user.email ? <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span> : null}
											</span>
											{selectedMemberIds.includes(user.id) ? (
												<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"><CheckIcon /></span>
											) : null}
										</button>
									))}
								</div>
							</div>
						</div>

						<button
							type="button"
							onClick={() => void handleCreateGroup()}
							disabled={isCreatingGroup}
							className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{t('createGroup')}
						</button>
					</div>
				</Modal>
			) : null}
			{isMembersOpen ? (
				<Modal contentClassName="max-w-xl overflow-hidden p-0">
					<div className="p-5 sm:p-6">
						<div className="flex items-center justify-between">
							<div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><UsersIcon /></div><h3 className="text-xl font-black text-slate-950 dark:text-white">{t('members')}</h3><p className="mt-1 text-sm text-slate-500">{t('peopleCount', {count: activeMembers.length})}</p></div>
							<button
								type="button"
								onClick={() => setIsMembersOpen(false)}
								className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800"
							>
								<CloseIcon />
							</button>
						</div>
						<div className="mt-5 max-h-56 space-y-2 overflow-auto pr-1">
							{activeMembers.map(member => (
								<div
									key={member.userId}
									className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">{getInitials(member.name)}</div><div className="min-w-0 flex-1">
										<p className="truncate text-sm font-bold text-slate-900 dark:text-white">
											{member.name}
										</p>
										<p className="text-xs text-slate-500">
											{t(`roles.${member.role}`)}
										</p>
									</div>
									{currentUserCanManageGroup && member.role !== 'OWNER' ? (
										<button
											type="button"
											onClick={() => setMemberToRemove(member.userId)}
											className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-500/10"
										>
											{t('remove')}
										</button>
									) : null}
								</div>
							))}
						</div>
						<div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
							<label className="text-sm font-bold text-slate-700 dark:text-slate-300">
								{t('addMembers')}
								<input
									value={memberSearch}
									onChange={event => setMemberSearch(event.target.value)}
									className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
								/>
							</label>
							<div className="mt-3 max-h-40 space-y-2 overflow-auto">
								{filteredUsers.map(user => (
									<button
										key={user.id}
										type="button"
										onClick={() =>
											setSelectedMemberIds(current =>
												current.includes(user.id)
													? current.filter(id => id !== user.id)
													: [...current, user.id]
											)
										}
										className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm dark:border-slate-700 ${selectedMemberIds.includes(user.id) ? 'border-violet-300 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200'}`}
									>
										<span>{user.fullName || user.name}</span>
										{selectedMemberIds.includes(user.id) ? (
											<span className="text-violet-600"><CheckIcon /></span>
										) : null}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={() => void handleAddMembers()}
								className="mt-3 h-11 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20"
							>
								{t('add')}
							</button>
						</div>
					</div>
				</Modal>
			) : null}
			{isRenaming ? (
				<Modal contentClassName="max-w-md overflow-hidden p-0">
					<div className="p-5 sm:p-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><EditIcon /></div><h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{t('renameGroup')}</h3><p className="mt-1 text-sm text-slate-500">{t('renameHint')}</p>
						<input
							value={newTitle}
							onChange={event => setNewTitle(event.target.value)}
							className="mt-5 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
						/>
						<div className="mt-4 flex gap-2">
							<button
								type="button"
								onClick={() => setIsRenaming(false)}
								className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
							>
								{t('cancel')}
							</button>
							<button
								type="button"
								onClick={() => void handleRenameGroup()}
								className="h-11 flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20"
							>
								{t('save')}
							</button>
						</div>
					</div>
				</Modal>
			) : null}
			<ConfirmDialog
				open={messageToDelete !== null}
				title={t('deleteMessageTitle')}
				description={t('deleteMessageDescription')}
				confirmLabel={t('deleteMessageConfirm')}
				isLoading={deletingMessageId !== null}
				onClose={() => setMessageToDelete(null)}
				onConfirm={() => messageToDelete ? handleDeleteMessage(messageToDelete) : undefined}
			/>
			<ConfirmDialog
				open={memberToRemove !== null}
				title={t('removeMemberTitle')}
				description={t('removeMemberDescription')}
				confirmLabel={t('removeMemberConfirm')}
				onClose={() => setMemberToRemove(null)}
				onConfirm={() => memberToRemove ? handleRemoveMember(memberToRemove) : undefined}
			/>
		</div>
	)
}
