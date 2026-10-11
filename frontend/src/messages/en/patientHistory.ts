export default {
    search: {
        title: 'Patients', subtitle: 'Find a patient in the selected clinic and open their work history.',
        clinic: 'Clinic', selectClinic: 'Select a clinic', query: 'Patient search',
        queryPlaceholder: 'Enter patient name', loadingClinics: 'Loading clinics…',
        clinicsError: 'Could not load clinics.', loading: 'Searching patients…',
        empty: 'No patients found.', selectHint: 'Select a clinic first.',
        loadError: 'Could not search patients.', retry: 'Retry', open: 'Open history',
    },
    history: {
        back: 'Back to patient search', title: 'Patient history', clinic: 'Clinic',
        orders: 'Orders', treatments: 'Treatments', loading: 'Loading patient history…',
        loadError: 'Could not load patient history.', forbidden: 'No access to the patient direction',
        notFound: 'Patient not found.', empty: 'This patient has no treatments yet.', retry: 'Retry',
        direction: 'Direction', workType: 'Work type', doctor: 'Doctor', technician: 'Technician',
        materials: 'Materials', teeth: 'Tooth numbers', quantity: 'Quantity', status: 'Status',
        orderedAt: 'Ordered', deadline: 'Deadline', completedAt: 'Completed',
        noDeadline: 'Not specified', notCompleted: 'Not completed', unassigned: 'Unassigned',
        noMaterials: 'Not specified', noTeeth: 'Not specified', comment: 'Comment',
        openOrder: 'Open order', openTask: 'Open task', page: 'Page {page} of {total}',
        previous: 'Previous', next: 'Next', order: 'Order {number}',
    },
} as const;
