export default {
    search: {
        title: 'Пациенты', subtitle: 'Найдите пациента в выбранной клинике и откройте историю работ.',
        clinic: 'Клиника', selectClinic: 'Выберите клинику', query: 'Поиск пациента',
        queryPlaceholder: 'Введите ФИО пациента', loadingClinics: 'Загрузка клиник…',
        clinicsError: 'Не удалось загрузить клиники.', loading: 'Поиск пациентов…',
        empty: 'Пациенты не найдены.', selectHint: 'Сначала выберите клинику.',
        loadError: 'Не удалось выполнить поиск.', retry: 'Повторить', open: 'Открыть историю',
    },
    history: {
        back: 'К поиску пациентов', title: 'История пациента', clinic: 'Клиника',
        orders: 'Заказов', treatments: 'Работ', loading: 'Загрузка истории пациента…',
        loadError: 'Не удалось загрузить историю пациента.', forbidden: 'Нет доступа к направлению пациента',
        notFound: 'Пациент не найден.', empty: 'В истории пациента пока нет работ.', retry: 'Повторить',
        direction: 'Направление', workType: 'Вид работы', doctor: 'Врач', technician: 'Техник',
        materials: 'Материалы', teeth: 'Номера зубов', quantity: 'Количество', status: 'Статус',
        orderedAt: 'Дата заказа', deadline: 'Дедлайн', completedAt: 'Завершено',
        noDeadline: 'Не указан', notCompleted: 'Не завершено', unassigned: 'Не назначен',
        noMaterials: 'Не указаны', noTeeth: 'Не указаны', comment: 'Комментарий',
        openOrder: 'Открыть заказ', openTask: 'Открыть задачу', page: 'Страница {page} из {total}',
        previous: 'Назад', next: 'Далее', order: 'Заказ {number}',
    },
} as const;
