const tvDashboard = {
    noDeadline: 'Мерзімі жоқ', today: 'Бүгін', tomorrow: 'Ертең', patientMissing: 'Пациент көрсетілмеген',
    order: 'Тапсырыс {number}', technicalWork: 'Техникалық жұмыс', overdueUpper: 'МЕРЗІМІ ӨТКЕН',
    teeth: 'Тістер {numbers}', items: '{count} дана',
    eyebrow: 'TeethTech · Өндіріс', title: 'Зертхананың жалпы экраны',
    metrics: {total: 'Барлық тапсырма', inProgress: 'Жұмыста', review: 'Тексеруде', overdue: 'Мерзімі өткен'},
    lightTheme: 'Ашық тақырып', light: 'Ашық', darkTheme: 'Қараңғы тақырып', dark: 'Қараңғы',
    fullscreen: 'Толық экран', close: 'TV экранын жабу', attention: 'Назар аударуды қажет етеді',
    overdueCount: '{count} мерзімі өткен', loadError: 'Тапсырмаларды жүктеу мүмкін болмады', retry: 'Қайталау',
    noTasks: 'Тапсырмалар жоқ', moreTasks: 'Бұл кезеңде тағы {count} тапсырма', rotationAria: 'Бағандар жиыны ауысқанға дейін',
    updating: 'Деректер жаңартылуда…', current: 'Деректер өзекті', autoUpdate: 'әр 30 секунд сайын жаңартылады',
    screen: '{current}/{total} экран', screenAria: '{number}-экран', visibleLimit: 'Әр кезеңде {count} тапсырмаға дейін көрсетіледі',
} as const;

export default tvDashboard;
