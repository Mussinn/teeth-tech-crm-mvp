const tvDashboard = {
    noDeadline: 'No deadline', today: 'Today', tomorrow: 'Tomorrow', patientMissing: 'Patient not specified',
    order: 'Order {number}', technicalWork: 'Technical work', overdueUpper: 'OVERDUE',
    teeth: 'Teeth {numbers}', items: '{count} items',
    eyebrow: 'TeethTech · Production', title: 'Laboratory overview screen',
    metrics: {total: 'Total tasks', inProgress: 'In progress', review: 'In review', overdue: 'Overdue'},
    lightTheme: 'Light theme', light: 'Light', darkTheme: 'Dark theme', dark: 'Dark',
    fullscreen: 'Full screen', close: 'Close TV screen', attention: 'Needs attention',
    overdueCount: '{count} overdue', loadError: 'Could not load tasks', retry: 'Retry',
    noTasks: 'No tasks', moreTasks: '{count} more tasks at this stage', rotationAria: 'Time until the next column set',
    updating: 'Updating data…', current: 'Data is current', autoUpdate: 'refreshes every 30 seconds',
    screen: 'Screen {current} of {total}', screenAria: 'Screen {number}', visibleLimit: 'Showing up to {count} tasks per stage',
} as const;

export default tvDashboard;
