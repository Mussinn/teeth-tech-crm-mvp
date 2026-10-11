import { Patient } from '@/src/types/patient.type';

export const mockPatients: Patient[] = [
    {
        id: '1',
        fullName: 'Иван Петров',
        phone: '+7 701 111 22 33',
        birthDate: '1994-04-12',
        clinicName: 'Dental Pro Clinic',
        doctorName: 'Доктор Алиев',
        status: 'ACTIVE',
        notes: [
            {
                id: 'n1',
                title: 'Общие заметки',
                description: 'Пациенту требуется аккуратная посадка коронки. Есть чувствительность.',
                createdAt: '2026-05-10',
            },
        ],
        orders: [
            {
                id: '101',
                orderNumber: 'ORD-101',
                workType: 'Коронка Zr',
                clinicName: 'Dental Pro Clinic',
                doctorName: 'Доктор Алиев',
                status: 'MODELING',
                createdAt: '2026-05-10',
                deadline: '2026-05-20',
            },
            {
                id: '102',
                orderNumber: 'ORD-102',
                workType: 'Виниры',
                clinicName: 'Dental Pro Clinic',
                doctorName: 'Доктор Алиев',
                status: 'DONE',
                createdAt: '2026-04-15',
                deadline: '2026-04-25',
            },
        ],
        files: [
            {
                id: 'f1',
                name: 'Медицинская карта.pdf',
                type: 'FILE',
                url: '#',
                createdAt: '2026-05-10',
            },
            {
                id: 'f2',
                name: 'Фото прикуса.jpg',
                type: 'IMAGE',
                url: '#',
                createdAt: '2026-05-11',
            },
            {
                id: 'f3',
                name: 'Видео примерки.mp4',
                type: 'VIDEO',
                url: '#',
                createdAt: '2026-05-12',
            },
        ],
    },
    {
        id: '2',
        fullName: 'Алия Нурланова',
        phone: '+7 777 555 44 33',
        birthDate: '1998-09-03',
        clinicName: 'Smile Dent',
        doctorName: 'Доктор Садыкова',
        status: 'ACTIVE',
        notes: [],
        orders: [],
        files: [],
    },
];