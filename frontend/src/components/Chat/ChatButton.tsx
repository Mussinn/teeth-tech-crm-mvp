'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { appendMessage, markChatRead, setMessages } from '@/src/features/chat/chatSlice'
import type { AppDispatch, RootState } from '@/src/lib/store'
import {
	useGetChatMessagesQuery,
	useMarkChatReadMutation,
	useSendTextMessageMutation
} from '@/src/services/api/chatApi'
import { formatChatTime, getInitials, normalizeMessages, sortByLastMessageAt } from '@/src/utils/chatUtils'
import { useAppLocale } from '@/src/i18n/provider'

function Icon({ name, className = 'h-5 w-5' }: { name: 'chat' | 'close' | 'back' | 'minimize' | 'send' | 'expand'; className?: string }) {
	const paths = {
		chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A8 8 0 1 1 21 15Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
		close: <path d="M18 6 6 18M6 6l12 12" />,
		back: <path d="m15 18-6-6 6-6" />,
		minimize: <path d="M5 12h14" />,
		send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
		expand: <><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></>
	}
	return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}

export default function ChatButton() {
	const t = useTranslations('chat.mini')
	const chatT = useTranslations('chat')
	const { locale } = useAppLocale()
	const pathname = usePathname()
	const router = useRouter()
	const dispatch = useDispatch<AppDispatch>()
	const { chats, messagesByConversation, totalUnreadCount } = useSelector((state: RootState) => state.chat)
	const { id: currentUserId } = useSelector((state: RootState) => state.auth)
	const [isOpen, setIsOpen] = useState(false)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [composer, setComposer] = useState('')
	const listRef = useRef<HTMLDivElement | null>(null)
	const sortedChats = useMemo(() => sortByLastMessageAt(chats), [chats])
	const selectedChat = chats.find(chat => chat.id === selectedId) ?? null
	const { data: messagePage, isFetching } = useGetChatMessagesQuery(
		{ conversationId: selectedId ?? '' },
		{ skip: !selectedId }
	)
	const [sendMessage, { isLoading: isSending }] = useSendTextMessageMutation()
	const [markRead] = useMarkChatReadMutation()
	const messages = useMemo(
		() => selectedId
			? (messagesByConversation[selectedId] ?? normalizeMessages(messagePage?.content ?? []))
			: [],
		[messagePage?.content, messagesByConversation, selectedId]
	)

	useEffect(() => {
		if (!selectedId || !messagePage) return
		dispatch(setMessages({ conversationId: selectedId, messages: messagePage.content }))
	}, [dispatch, messagePage, selectedId])

	useEffect(() => {
		if (!isOpen || !selectedId || !listRef.current) return
		listRef.current.scrollTop = listRef.current.scrollHeight
	}, [isOpen, messages.length, selectedId])

	useEffect(() => {
		const toggleChat = () => setIsOpen(current => !current)
		const closeChat = () => setIsOpen(false)

		window.addEventListener('teethtech:toggle-chat', toggleChat)
		window.addEventListener('teethtech:close-chat', closeChat)

		return () => {
			window.removeEventListener('teethtech:toggle-chat', toggleChat)
			window.removeEventListener('teethtech:close-chat', closeChat)
		}
	}, [])

	if (pathname.startsWith('/chats')) return null

	const openConversation = (conversationId: string) => {
		setSelectedId(conversationId)
		dispatch(markChatRead(conversationId))
		void markRead(conversationId)
	}

	const handleSend = async () => {
		const text = composer.trim()
		if (!selectedId || !text || isSending) return
		try {
			const message = await sendMessage({ conversationId: selectedId, body: { text, replyToId: null } }).unwrap()
			dispatch(appendMessage(message))
			setComposer('')
		} catch {
			// The full messenger keeps the detailed error flow; the mini chat stays unobtrusive.
		}
	}

	return (
		<div className="fixed bottom-24 right-4 z-[80] sm:right-6">
			{isOpen ? (
				<section className="mb-3 flex h-[min(610px,calc(100dvh-7rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-22px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-900">
					<header className="flex min-h-[72px] items-center gap-3 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-white">
						{selectedChat ? <button type="button" onClick={() => setSelectedId(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={t('back')}><Icon name="back" /></button> : <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15"><Icon name="chat" /></span>}
						<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{selectedChat?.title ?? t('title')}</p><p className="mt-0.5 text-[11px] text-violet-100">{selectedChat ? t('online') : t('unread', {count: totalUnreadCount})}</p></div>
						{selectedChat ? <button type="button" onClick={() => router.push(`/chats/${selectedChat.id}`)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={t('openFull')}><Icon name="expand" className="h-4 w-4" /></button> : null}
						<button type="button" onClick={() => setIsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={t('minimize')}><Icon name="minimize" /></button>
						<button type="button" onClick={() => setIsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={t('close')}><Icon name="close" /></button>
					</header>

					{selectedChat ? (
						<>
							<div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
								{isFetching && messages.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">{t('loading')}</p> : null}
								{messages.map(message => {
									const mine = message.senderId === currentUserId
									return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${mine ? 'rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white'}`}><p className="whitespace-pre-wrap leading-5">{message.deleted ? chatT('deletedMessage') : message.text}</p><p className={`mt-1 text-right text-[9px] ${mine ? 'text-violet-100' : 'text-slate-400'}`}>{formatChatTime(message.createdAt, locale)}{mine ? ' · ✓✓' : ''}</p></div></div>
								})}
							</div>
							<div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-end gap-2 rounded-2xl bg-slate-100 p-2 dark:bg-slate-800"><textarea value={composer} onChange={event => setComposer(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend() } }} rows={1} placeholder={t('placeholder')} className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none dark:text-white" /><button type="button" onClick={() => void handleSend()} disabled={!composer.trim() || isSending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md disabled:opacity-40" aria-label={t('send')}><Icon name="send" className="h-4 w-4" /></button></div></div>
						</>
					) : (
						<div className="flex-1 overflow-y-auto p-2.5">
							<div className="px-2 pb-2 pt-1"><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{t('recent')}</p></div>
							{sortedChats.length ? sortedChats.map(chat => <button key={chat.id} type="button" onClick={() => openConversation(chat.id)} className="mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-violet-50 dark:hover:bg-violet-500/10"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-black text-white">{getInitials(chat.title)}<i className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className="truncate text-sm text-slate-900 dark:text-white">{chat.title}</b><small className="text-[9px] text-slate-400">{formatChatTime(chat.lastMessageAt, locale)}</small></span><span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-slate-500">{chat.lastMessage ?? chatT('startDialogue')}</span>{chat.unreadCount > 0 ? <b className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] text-white">{chat.unreadCount}</b> : null}</span></span></button>) : <p className="py-12 text-center text-sm text-slate-500">{t('noDialogs')}</p>}
						</div>
					)}
				</section>
			) : null}
		</div>
	)
}
