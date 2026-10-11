import auth from './auth';
import common from './common';
import dashboard from './dashboard';
import analytics from './analytics';
import glossary from './glossary';
import header from './header';
import navigation from './navigation';
import orders from './orders';
import clinics from './clinics';
import laboratory from './laboratory';
import warehouse from './warehouse';
import workspace from './workspace';
import accounting from './accounting';
import settings from './settings';
import tasks from './tasks';
import documents from './documents';
import employees from './employees';
import knowledgeBase from './knowledgeBase';
import chat from './chat';
import tvDashboard from './tvDashboard';
import apiNotifications from './apiNotifications';
import workDirections from './workDirections';
import patientHistory from './patientHistory';

const messages = {accounting, analytics, apiNotifications, auth, chat, clinics, common, dashboard, documents, employees, glossary, header, knowledgeBase, laboratory, navigation, orders, patientHistory, settings, tasks, tvDashboard, warehouse, workDirections, workspace} as const;

export default messages;
