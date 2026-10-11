export default {
    search: {
        title: 'Пациенттер', subtitle: 'Таңдалған клиникадан пациентті тауып, жұмыс тарихын ашыңыз.',
        clinic: 'Клиника', selectClinic: 'Клиниканы таңдаңыз', query: 'Пациентті іздеу',
        queryPlaceholder: 'Пациенттің аты-жөнін енгізіңіз', loadingClinics: 'Клиникалар жүктелуде…',
        clinicsError: 'Клиникаларды жүктеу мүмкін болмады.', loading: 'Пациенттер ізделуде…',
        empty: 'Пациенттер табылмады.', selectHint: 'Алдымен клиниканы таңдаңыз.',
        loadError: 'Іздеуді орындау мүмкін болмады.', retry: 'Қайталау', open: 'Тарихты ашу',
    },
    history: {
        back: 'Пациенттерді іздеуге оралу', title: 'Пациент тарихы', clinic: 'Клиника',
        orders: 'Тапсырыс', treatments: 'Жұмыс', loading: 'Пациент тарихы жүктелуде…',
        loadError: 'Пациент тарихын жүктеу мүмкін болмады.', forbidden: 'Пациент бағытына қолжетімділік жоқ',
        notFound: 'Пациент табылмады.', empty: 'Пациент тарихында жұмыс жоқ.', retry: 'Қайталау',
        direction: 'Бағыт', workType: 'Жұмыс түрі', doctor: 'Дәрігер', technician: 'Техник',
        materials: 'Материалдар', teeth: 'Тіс нөмірлері', quantity: 'Саны', status: 'Күйі',
        orderedAt: 'Тапсырыс күні', deadline: 'Мерзімі', completedAt: 'Аяқталды',
        noDeadline: 'Көрсетілмеген', notCompleted: 'Аяқталмаған', unassigned: 'Тағайындалмаған',
        noMaterials: 'Көрсетілмеген', noTeeth: 'Көрсетілмеген', comment: 'Түсініктеме',
        openOrder: 'Тапсырысты ашу', openTask: 'Тапсырманы ашу', page: '{page} / {total} бет',
        previous: 'Артқа', next: 'Келесі', order: '{number} тапсырыс',
    },
} as const;
