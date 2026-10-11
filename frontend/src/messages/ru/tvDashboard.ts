const tvDashboard = {
    noDeadline: 'Без срока', today: 'Сегодня', tomorrow: 'Завтра', patientMissing: 'Пациент не указан',
    order: 'Заказ {number}', technicalWork: 'Техническая работа', overdueUpper: 'ПРОСРОЧЕНО',
    teeth: 'Зубы {numbers}', items: '{count} шт.',
    eyebrow: 'TeethTech · Производство', title: 'Общий экран лаборатории',
    metrics: {total: 'Всего задач', inProgress: 'В работе', review: 'На проверке', overdue: 'Просрочено'},
    lightTheme: 'Светлая тема', light: 'Светлая', darkTheme: 'Тёмная тема', dark: 'Тёмная',
    fullscreen: 'Полный экран', close: 'Закрыть ТВ-экран', attention: 'Требуют внимания',
    overdueCount: '{count} просрочено', loadError: 'Не удалось загрузить задачи', retry: 'Повторить',
    noTasks: 'Нет задач', moreTasks: 'Ещё {count} задач на этом этапе', rotationAria: 'До смены набора колонок',
    updating: 'Обновляем данные…', current: 'Данные актуальны', autoUpdate: 'автообновление каждые 30 секунд',
    screen: 'Экран {current} из {total}', screenAria: 'Экран {number}', visibleLimit: 'Показывается до {count} задач на этап',
} as const;

export default tvDashboard;
