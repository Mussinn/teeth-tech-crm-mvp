import authReducer from '@/src/features/auth/authSlice'
import { logout, setUser } from '@/src/features/auth/authSlice'
import chatReducer from '@/src/features/chat/chatSlice'
import notificationsReducer from '@/src/features/notifications/notificationsSlice'
import { chatApi } from '@/src/services/api/chatApi'
import { teethTechApi } from '@/src/services/teethTechApi'
import { combineReducers, configureStore, type UnknownAction } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'

const combinedReducer = combineReducers({
	auth: authReducer,
	notifications: notificationsReducer,
	chat: chatReducer,
	[teethTechApi.reducerPath]: teethTechApi.reducer,
	[chatApi.reducerPath]: chatApi.reducer
})

const rootReducer = (
	state: ReturnType<typeof combinedReducer> | undefined,
	action: UnknownAction
) => {
	const isSessionReplacement =
		action.type === setUser.type
		&& state?.auth.id !== null
		&& state?.auth.id !== (action.payload as { id?: unknown }).id

	return combinedReducer(
		action.type === logout.type || isSessionReplacement ? undefined : state,
		action
	)
}

export const makeStore = () => {
	const store = configureStore({
		reducer: rootReducer,
		middleware: getDefaultMiddleware =>
			getDefaultMiddleware().concat(teethTechApi.middleware, chatApi.middleware)
	})

	setupListeners(store.dispatch)

	return store
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
