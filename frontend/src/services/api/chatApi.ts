import type {
	BaseQueryFn,
	FetchArgs,
	FetchBaseQueryError
} from '@reduxjs/toolkit/query'
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import { logout } from '@/src/features/auth/authSlice'
import type {
	ChatAddMembersRequest,
	ChatAttachmentUrlDto,
	ChatCreateDirectRequest,
	ChatCreateGroupRequest,
	ChatMemberDto,
	ChatMessageDto,
	ChatMessagePayload,
	ChatMessagesPageDto,
	ChatRenameGroupRequest,
	ChatSummaryDto
} from '@/src/types/chat.types'

const API_BASE_URL = '/api/backend'

const rawBaseQuery = fetchBaseQuery({
	baseUrl: API_BASE_URL,
	credentials: 'same-origin'
})

const baseQueryWithAuth: BaseQueryFn<
	string | FetchArgs,
	unknown,
	FetchBaseQueryError
> = async (args, api, extraOptions) => {
	const result = await rawBaseQuery(args, api, extraOptions)

	if (result.error?.status === 401) {
		api.dispatch(logout())
	}

	return result
}

export const chatApi = createApi({
	reducerPath: 'chatApi',
	baseQuery: baseQueryWithAuth,
	tagTypes: ['ChatList', 'ChatMessages', 'ChatMembers'],
	endpoints: builder => ({
		getChats: builder.query<ChatSummaryDto[], void>({
			query: () => ({
				url: '/chats',
				method: 'GET'
			}),
			providesTags: ['ChatList']
		}),
		createDirectChat: builder.mutation<ChatSummaryDto, ChatCreateDirectRequest>(
			{
				query: body => ({
					url: '/chats/direct',
					method: 'POST',
					body
				}),
				invalidatesTags: ['ChatList']
			}
		),
		createGroupChat: builder.mutation<ChatSummaryDto, ChatCreateGroupRequest>({
			query: body => ({
				url: '/chats/groups',
				method: 'POST',
				body
			}),
			invalidatesTags: ['ChatList']
		}),
		getChatMembers: builder.query<ChatMemberDto[], string>({
			query: conversationId => ({
				url: `/chats/${conversationId}/members`,
				method: 'GET'
			}),
			providesTags: (_result, _error, conversationId) => [
				{ type: 'ChatMembers', id: conversationId }
			]
		}),
		addChatMembers: builder.mutation<
			void,
			{ conversationId: string; body: ChatAddMembersRequest }
		>({
			query: ({ conversationId, body }) => ({
				url: `/chats/${conversationId}/members`,
				method: 'POST',
				body
			}),
			invalidatesTags: ['ChatMembers']
		}),
		removeChatMember: builder.mutation<
			void,
			{ conversationId: string; memberId: string }
		>({
			query: ({ conversationId, memberId }) => ({
				url: `/chats/${conversationId}/members/${memberId}`,
				method: 'DELETE'
			}),
			invalidatesTags: ['ChatMembers']
		}),
		renameGroupChat: builder.mutation<
			ChatSummaryDto,
			{ conversationId: string; body: ChatRenameGroupRequest }
		>({
			query: ({ conversationId, body }) => ({
				url: `/chats/${conversationId}`,
				method: 'PATCH',
				body
			}),
			invalidatesTags: ['ChatList']
		}),
		getChatMessages: builder.query<
			ChatMessagesPageDto,
			{ conversationId: string; before?: string | null }
		>({
			query: ({ conversationId, before }) => ({
				url: `/chats/${conversationId}/messages`,
				method: 'GET',
				params: before ? { before, size: 50 } : { size: 50 }
			}),
			providesTags: (_result, _error, { conversationId }) => [
				{ type: 'ChatMessages', id: conversationId }
			]
		}),
		sendTextMessage: builder.mutation<
			ChatMessageDto,
			{ conversationId: string; body: ChatMessagePayload }
		>({
			query: ({ conversationId, body }) => ({
				url: `/chats/${conversationId}/messages`,
				method: 'POST',
				body
			}),
			invalidatesTags: ['ChatList']
		}),
		deleteChatMessage: builder.mutation<
			void,
			{ conversationId: string; messageId: string }
		>({
			query: ({ conversationId, messageId }) => ({
				url: `/chats/${conversationId}/messages/${messageId}`,
				method: 'DELETE'
			}),
			invalidatesTags: (_result, _error, { conversationId }) => [
				'ChatList',
				{ type: 'ChatMessages', id: conversationId }
			]
		}),
		uploadChatFile: builder.mutation<
			ChatMessageDto,
			{ conversationId: string; formData: FormData }
		>({
			query: ({ conversationId, formData }) => ({
				url: `/chats/${conversationId}/messages/file`,
				method: 'POST',
				body: formData
			}),
			invalidatesTags: ['ChatList']
		}),
		getAttachmentUrl: builder.query<
			ChatAttachmentUrlDto,
			{ conversationId: string; attachmentId: string }
		>({
			query: ({ conversationId, attachmentId }) => ({
				url: `/chats/${conversationId}/attachments/${attachmentId}/url`,
				method: 'GET'
			})
		}),
		markChatRead: builder.mutation<void, string>({
			query: conversationId => ({
				url: `/chats/${conversationId}/read`,
				method: 'POST'
			}),
			invalidatesTags: ['ChatList']
		})
	})
})

export const {
	useGetChatsQuery,
	useCreateDirectChatMutation,
	useCreateGroupChatMutation,
	useGetChatMembersQuery,
	useAddChatMembersMutation,
	useRemoveChatMemberMutation,
	useRenameGroupChatMutation,
	useGetChatMessagesQuery,
	useSendTextMessageMutation,
	useDeleteChatMessageMutation,
	useUploadChatFileMutation,
	useGetAttachmentUrlQuery,
	useMarkChatReadMutation
} = chatApi
