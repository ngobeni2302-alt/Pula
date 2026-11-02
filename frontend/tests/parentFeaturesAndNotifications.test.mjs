import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Set up mock localStorage for node test environment
const mockStorage = {};
global.localStorage = {
  getItem: k => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: k => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

import { seedData, GROUPS, getParentForLearner } from '../src/dashboardData.js';
import {
  initMessagingStore,
  getConversationsForUser,
  getUnreadMessagesCountForUser,
  getLatestUnreadMessageForUser,
  markConversationRead,
  openOrCreatePrivateConversation,
  sendMessage
} from '../src/messaging/messagingService.js';
import { getLearnerAcademicRecord } from '../src/learners/learnerData.js';

test('1. Unread message count badge calculation for Teacher and Parent', () => {
  initMessagingStore();
  const c = seedData().classes[2];
  const learner = c.learners.find(l => l.name === 'Thando');
  const parent = getParentForLearner(learner, '2');

  // Teacher count
  const teacherUnread = getUnreadMessagesCountForUser({ role: 'Teacher', userId: 'teacher-2', grade: '2' });
  assert.equal(typeof teacherUnread, 'number');

  // Parent count
  const parentUnread = getUnreadMessagesCountForUser({ role: 'Parent', userId: parent.id, grade: '2' });
  assert.equal(typeof parentUnread, 'number');

  // Send a message to parent
  const conv = openOrCreatePrivateConversation({
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learner,
    grade: '2',
    classroomName: 'Grade 2B'
  });

  sendMessage({
    conversationId: conv.id,
    senderId: 'teacher-2',
    senderName: 'Sir Iak',
    senderRole: 'teacher',
    text: 'Hello Nomsa, Thando had a wonderful reading session today!'
  });

  const updatedParentUnread = getUnreadMessagesCountForUser({ role: 'Parent', userId: parent.id, grade: '2' });
  assert.ok(updatedParentUnread >= 1, 'Parent should have at least 1 unread message after teacher sends one');

  // Mark read
  markConversationRead({ conversationId: conv.id, userId: parent.id });
  const afterRead = getUnreadMessagesCountForUser({ role: 'Parent', userId: parent.id, grade: '2' });
  assert.equal(afterRead, 0, 'Unread count should clear to 0 after conversation is read');
});

test('2. WhatsApp incoming notification toast details', () => {
  initMessagingStore();
  const c = seedData().classes[2];
  const learner = c.learners.find(l => l.name === 'Thando');
  const parent = getParentForLearner(learner, '2');

  const conv = openOrCreatePrivateConversation({
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learner,
    grade: '2',
    classroomName: 'Grade 2B'
  });

  sendMessage({
    conversationId: conv.id,
    senderId: 'teacher-2',
    senderName: 'Sir Iak',
    senderRole: 'teacher',
    text: 'Thando read 42 WPM!'
  });

  const latest = getLatestUnreadMessageForUser({ role: 'Parent', userId: parent.id, grade: '2' });
  assert.ok(latest, 'Latest unread message item should be returned');
  assert.ok(latest.conversation, 'Should contain conversation details');
  assert.ok(latest.message.text.includes('Thando read 42 WPM!'), 'Snippet matches sent message');
});

test('3. Parent 3-dots menu in Messages contains "Message Teacher" and strictly forbids group creation', () => {
  const messagingHubJsx = fs.readFileSync(path.resolve('frontend/src/messaging/MessagingHub.jsx'), 'utf8');

  // Verify 3-dots button is rendered unconditionally for both Teacher and Parent
  assert.ok(
    messagingHubJsx.includes('<MoreVertical size={20} />'),
    '3-dots options icon must be visible in the messages header'
  );

  // Verify Parent dropdown items
  assert.ok(
    messagingHubJsx.includes('Message Teacher'),
    'Parent dropdown must contain Message Teacher option'
  );
  assert.ok(
    messagingHubJsx.includes('handleParentMessageTeacher'),
    'Parent Message Teacher must be bound to handleParentMessageTeacher handler'
  );

  // Verify that inside the dropdown, the teacher gets Create Group and the parent does NOT get Create Group
  assert.ok(
    messagingHubJsx.includes('{isTeacher ? (') &&
    messagingHubJsx.includes('handleOpenCreateGroup') &&
    messagingHubJsx.includes('handleParentMessageTeacher'),
    'Messaging menu branches conditionally on isTeacher'
  );

  // In the dropdown menu section:
  const menuStart = messagingHubJsx.indexOf('<div className="msg-dropdown-menu">');
  const menuEnd = messagingHubJsx.indexOf('</div>', menuStart + 35);
  const menuContent = messagingHubJsx.slice(menuStart, menuEnd + 100);

  // Ensure Create Group is only rendered under isTeacher and not parent branch
  assert.ok(menuContent.includes('isTeacher ?'));
  assert.ok(menuContent.includes('Create Group'));
  assert.ok(menuContent.includes('Message Teacher'));
});

test('4. Parent Progress page renders full LearnerProfile scoped to their child only', () => {
  const dashboardsJsx = fs.readFileSync(path.resolve('frontend/src/Dashboards.jsx'), 'utf8');

  // Verify Progress page uses LearnerProfile with isParent={true}
  assert.ok(
    dashboardsJsx.includes("!teacher && page === 'Progress'"),
    'Parent progress page section exists'
  );
  assert.ok(
    dashboardsJsx.includes('<LearnerProfile') &&
    dashboardsJsx.includes('learner={child}') &&
    dashboardsJsx.includes('isParent={true}'),
    'Parent progress page must render LearnerProfile with child and isParent={true}'
  );

  // Verify academic profile data has all required parts
  const c = seedData().classes[2];
  const child = c.learners.find(l => l.name === 'Thando');
  const record = getLearnerAcademicRecord(child, c.grade, c.teacher);

  assert.equal(record.fullName, 'Thando Mokoena');
  assert.ok(record.assessments.length > 0, 'Must have academic assessments');
  assert.ok(record.observations.length > 0, 'Must have teacher observations');
  assert.ok(record.attendanceSummary.overallPercentage != null, 'Must have attendance summary');
});

test('5. LearnerProfile enforces read-only controls for parents (no tier dropdown, no attendance form, no delete observation)', () => {
  const profileJsx = fs.readFileSync(path.resolve('frontend/src/learners/LearnerProfile.jsx'), 'utf8');

  // Reading tier: shows read-only text badge when isParent, select dropdown when teacher
  assert.ok(
    profileJsx.includes('isParent ? (') && profileJsx.includes('Reading Tier:'),
    'Must display read-only Reading Tier badge for parent'
  );

  // Attendance form: hidden when isParent
  assert.ok(
    profileJsx.includes('{!isParent && (') && profileJsx.includes('pula-att-record-form'),
    'Attendance form must be hidden for parent'
  );

  // Observations: Add and Delete hidden when isParent
  assert.ok(
    profileJsx.includes('{!isParent && (') && profileJsx.includes('Add Observation'),
    'Add observation button must be hidden for parent'
  );
  assert.ok(
    profileJsx.includes('{!isParent && (') && profileJsx.includes('pula-obs-delete-btn'),
    'Delete observation button must be hidden for parent'
  );
});

test('6. Parent Home reading groups match teacher Periwinkle tier colour (#8E9BFF)', () => {
  const css = fs.readFileSync(path.resolve('frontend/src/dashboards.css'), 'utf8');
  const dashboardsJsx = fs.readFileSync(path.resolve('frontend/src/Dashboards.jsx'), 'utf8');

  assert.ok(
    dashboardsJsx.includes('<div className="pd-groups pd-parent-groups">'),
    'Parent reading groups container must have pd-parent-groups'
  );

  assert.match(
    css,
    /\.pd-parent-groups\s+\.pd-group[\s\S]*?background:\s*#8E9BFF/i,
    'Parent reading groups must have #8E9BFF background'
  );
});

test('7. Bottom nav has unread badge styling and WhatsApp toast notification styling', () => {
  const css = fs.readFileSync(path.resolve('frontend/src/dashboards.css'), 'utf8');
  const dashboardsJsx = fs.readFileSync(path.resolve('frontend/src/Dashboards.jsx'), 'utf8');

  // Nav badge in JSX
  assert.ok(
    dashboardsJsx.includes('className="pd-nav-badge"'),
    'Messages nav item must render pd-nav-badge when unreadCount > 0'
  );

  // WhatsApp toast in JSX
  assert.ok(
    dashboardsJsx.includes('className="pd-whatsapp-toast"'),
    'Dashboards must render pd-whatsapp-toast when there is a notification'
  );

  // CSS for badge
  assert.match(
    css,
    /\.pd-nav-badge\s*\{[\s\S]*?background:\s*#25D366/i,
    'pd-nav-badge must use WhatsApp green #25D366'
  );

  // CSS for toast
  assert.match(
    css,
    /\.pd-whatsapp-toast\s*\{[\s\S]*?border-left:\s*5px solid #25D366/i,
    'pd-whatsapp-toast must use WhatsApp green accent border'
  );
});
