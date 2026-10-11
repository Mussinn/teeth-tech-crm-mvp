export default {
    management: {
        badge: 'Administrative directories', title: 'Work directions',
        subtitle: 'Directions define dispatcher visibility and are assigned to every technical task.',
        create: '+ Add direction', createTitle: 'New direction', editTitle: 'Edit direction',
        name: 'Name', code: 'Code',
        codeHint: 'Use Latin letters, digits, and underscores. The backend stores the code in uppercase.',
        description: 'Description', status: 'Status', actions: 'Actions', activeField: 'Direction is active',
        active: 'Active', inactive: 'Inactive', noDescription: 'No description', loading: 'Loading directions…',
        loadError: 'Could not load work directions.', empty: 'No work directions have been created.',
        nameRequired: 'Enter a direction name.',
        codeInvalid: 'The code must start with a Latin letter and contain only Latin letters, digits, and underscores.',
        saving: 'Saving…', forbidden: 'Insufficient permissions',
        forbiddenHint: 'Only an administrator can manage work directions.',
    },
} as const;
