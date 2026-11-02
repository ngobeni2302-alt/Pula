import test from 'node:test';
import assert from 'node:assert/strict';

// Set up mock localStorage for node test environment
const mockStorage = {};
global.localStorage = {
  getItem: k => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: k => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

import {
  seedData,
  loadData,
  getParentForLearner,
  GROUPS,
  TOPICS,
  PLANS
} from '../src/dashboardData.js';

import {
  initMessagingStore,
  getMessagingStore,
  getConversationsForUser,
  getPendingInvitationsForParent,
  getGroupInvitationsForTeacher,
  getConversationMessages,
  sendMessage,
  openOrCreatePrivateConversation,
  createGroup,
  respondToInvitation,
  updateGroupSettings,
  addGroupMembers,
  removeGroupMember,
  generateLesediDraft,
  formatMessageTime
} from '../src/messaging/messagingService.js';

test('1. Teacher opens Messages and sees existing conversations', () => {
  initMessagingStore();
  const db = seedData();
  const teacherConvs = getConversationsForUser({
    role: 'Teacher',
    userId: 'teacher-2',
    grade: '2',
    classroom: db.classes[2],
    classes: db.classes
  });

  assert.ok(teacherConvs.length >= 2, 'Teacher should have at least 2 default conversations');
  assert.ok(teacherConvs.some(c => c.title.includes("Thando's Parent")), 'Should see Thando conversation');
  assert.ok(teacherConvs.some(c => c.type === 'group' && c.title.includes('Grade 2 Parents')), 'Should see Grade 2 group');
});

test('2. Teacher selects Contact Parent & 3. Selects a learner & 4. Correct linked parent conversation opens', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner = c.learners.find(l => l.name === 'Thando');
  const parent = getParentForLearner(learner, '2');

  assert.equal(parent.name, 'Nomsa Mokoena');
  assert.equal(parent.relationship, 'Mother');

  const conv = openOrCreatePrivateConversation({
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learner,
    grade: '2',
    classroomName: 'Grade 2B'
  });

  assert.ok(conv);
  assert.equal(conv.learnerId, learner.id);
  assert.equal(conv.parentId, parent.id);
  assert.ok(conv.participantIds.includes('teacher-2'));
  assert.ok(conv.participantIds.includes(parent.id));
});

test('5. Teacher sends a message, 6. Parent receives, 7. Parent replies, 8. Teacher receives', () => {
  const db = seedData();
  const learner = db.classes[2].learners.find(l => l.name === 'Thando');
  const parent = getParentForLearner(learner, '2');

  const conv = openOrCreatePrivateConversation({
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learner,
    grade: '2',
    classroomName: 'Grade 2B'
  });

  // 5. Teacher sends message
  const teacherMsg = sendMessage({
    conversationId: conv.id,
    senderId: 'teacher-2',
    senderName: 'Sir Iak',
    senderRole: 'teacher',
    text: 'Thando read 38 words per minute today!'
  });
  assert.equal(teacherMsg.text, 'Thando read 38 words per minute today!');

  // 6. Parent sees message in thread
  let messages = getConversationMessages(conv.id);
  assert.ok(messages.some(m => m.text === 'Thando read 38 words per minute today!' && m.senderRole === 'teacher'));

  // 7. Parent replies
  const parentMsg = sendMessage({
    conversationId: conv.id,
    senderId: parent.id,
    senderName: parent.name,
    senderRole: 'parent',
    text: 'Thank you Sir Iak! We are proud of her.'
  });
  assert.ok(parentMsg);

  // 8. Teacher receives the reply in conversation
  messages = getConversationMessages(conv.id);
  const lastMsg = messages.at(-1);
  assert.equal(lastMsg.senderId, parent.id);
  assert.equal(lastMsg.text, 'Thank you Sir Iak! We are proud of her.');
});

test('9. Teacher creates a group, 10. Selects multiple learners, 11. Linked parents receive invitations', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner1 = c.learners[8]; // Thando
  const learner2 = c.learners[1]; // Lerato
  const parent1 = getParentForLearner(learner1, '2');
  const parent2 = getParentForLearner(learner2, '2');

  const { group, conversation } = createGroup({
    name: 'Sprout Phonics Support Group',
    description: 'Weekly phonics practice for Grade 2B',
    grade: '2',
    classroomName: 'Grade 2B',
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learnerIds: [learner1.id, learner2.id],
    onlyAdminCanSend: false,
    learnersList: c.learners
  });

  assert.equal(group.name, 'Sprout Phonics Support Group');
  assert.equal(group.teacherAdminId, 'teacher-2');

  // Both parents should have invitations
  const p1Invs = getPendingInvitationsForParent(parent1.id);
  const p2Invs = getPendingInvitationsForParent(parent2.id);

  assert.ok(p1Invs.some(i => i.groupId === group.id), 'Parent 1 has invitation');
  assert.ok(p2Invs.some(i => i.groupId === group.id), 'Parent 2 has invitation');
});

test('12. Parent accepts invitation, 13. Parent joins group, 14. Parent declines another, 15. Declined cannot access', () => {
  const db = seedData();
  const c = db.classes[2];
  const learner1 = c.learners[8];
  const learner2 = c.learners[1];
  const parent1 = getParentForLearner(learner1, '2');
  const parent2 = getParentForLearner(learner2, '2');

  const { group, conversation } = createGroup({
    name: 'Term 4 Reading Circle',
    description: 'Term 4 group',
    grade: '2',
    classroomName: 'Grade 2B',
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learnerIds: [learner1.id, learner2.id],
    learnersList: c.learners
  });

  const p1Inv = getPendingInvitationsForParent(parent1.id).find(i => i.groupId === group.id);
  const p2Inv = getPendingInvitationsForParent(parent2.id).find(i => i.groupId === group.id);

  // 12. Parent 1 accepts
  respondToInvitation({ invitationId: p1Inv.id, parentId: parent1.id, action: 'accept' });

  // 13. Parent 1 now sees group in their conversations
  const p1Convs = getConversationsForUser({
    role: 'Parent',
    userId: parent1.id,
    grade: '2',
    classroom: c,
    classes: db.classes
  });
  assert.ok(p1Convs.some(conv => conv.groupId === group.id), 'Parent 1 can see accepted group');

  // 14. Parent 2 declines
  respondToInvitation({ invitationId: p2Inv.id, parentId: parent2.id, action: 'decline' });

  // 15. Parent 2 cannot access or see group in their conversations
  const p2Convs = getConversationsForUser({
    role: 'Parent',
    userId: parent2.id,
    grade: '2',
    classroom: c,
    classes: db.classes
  });
  assert.ok(!p2Convs.some(conv => conv.groupId === group.id), 'Parent 2 cannot access declined group');
});

test('16. Teacher sends a group message, 17. Accepted parents receive the message', () => {
  const store = getMessagingStore();
  const group = store.groups[0];
  const conv = store.conversations.find(c => c.groupId === group.id);

  sendMessage({
    conversationId: conv.id,
    senderId: 'teacher-2',
    senderName: 'Sir Iak',
    senderRole: 'teacher',
    text: 'Please remember to bring reading logs tomorrow!'
  });

  const msgs = getConversationMessages(conv.id);
  assert.ok(msgs.some(m => m.text === 'Please remember to bring reading logs tomorrow!'));
});

test('18. Teacher adds another parent, 19. Teacher removes a member, 20. Parent leaves group', () => {
  const db = seedData();
  const c = db.classes[2];
  const store = getMessagingStore();
  const group = store.groups[0];

  // 18. Add another parent (learner index 2: Sipho)
  const newLearner = c.learners[2];
  const newParent = getParentForLearner(newLearner, '2');
  const updatedGroup = addGroupMembers({
    groupId: group.id,
    learnerIds: [newLearner.id],
    learnersList: c.learners,
    grade: '2'
  });

  assert.ok(updatedGroup.members.some(m => m.id === newParent.id), 'New parent added as pending member');

  // 19. Remove member
  const groupAfterRemove = removeGroupMember({ groupId: group.id, memberId: newParent.id });
  assert.ok(!groupAfterRemove.members.some(m => m.id === newParent.id), 'Member removed by teacher');

  // 20. Parent leaves
  const existingMember = groupAfterRemove.members.find(m => m.role === 'member');
  if (existingMember) {
    const groupAfterLeave = removeGroupMember({ groupId: group.id, memberId: existingMember.id });
    assert.ok(!groupAfterLeave.members.some(m => m.id === existingMember.id), 'Parent left group');
  }
});

test('21. Lesedi drafts a message, 22. Teacher reviews and approves draft', () => {
  const db = seedData();
  const learner = db.classes[2].learners[8];

  // 21. Lesedi generates draft for topic
  for (const topic of ['Progress', 'Test', 'Exam', 'Spelling test', 'Homework']) {
    const draft = generateLesediDraft(topic, learner, db.classes[2]);
    assert.ok(draft.length > 20, `Draft for ${topic} should contain content`);
    assert.ok(draft.includes('Thando'), 'Draft should reference learner name');
  }

  // 22. Teacher approves and sends
  const draft = generateLesediDraft('Homework', learner, db.classes[2]);
  const conv = openOrCreatePrivateConversation({
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learner,
    grade: '2',
    classroomName: 'Grade 2B'
  });

  const sent = sendMessage({
    conversationId: conv.id,
    senderId: 'teacher-2',
    senderName: 'Sir Iak',
    senderRole: 'teacher',
    text: draft,
    category: 'Homework'
  });

  assert.equal(sent.category, 'Homework');
  assert.equal(sent.text, draft);
});

test('23. Existing dashboard functionality remains unchanged', () => {
  const db = seedData();
  assert.equal(db.classes.length, 4);
  assert.equal(db.classes.flatMap(c => c.learners).length, 148);
  assert.equal(db.directives.length, 3);
  assert.equal(db.observations.length, 1);
});

test('24. Messaging works correctly with message timestamps and formatting', () => {
  const now = new Date().toISOString();
  assert.ok(formatMessageTime(now).includes(':'));
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  assert.equal(formatMessageTime(yesterday), 'Yesterday');
});

test('25. Users cannot access unauthorized conversations', () => {
  const db = seedData();
  const parent1 = getParentForLearner(db.classes[2].learners[8], '2'); // Thando's parent
  const parent2 = getParentForLearner(db.classes[2].learners[1], '2'); // Lerato's parent

  // Private conversation for parent1
  const conv1 = openOrCreatePrivateConversation({
    teacherId: 'teacher-2',
    teacherName: 'Sir Iak',
    learner: db.classes[2].learners[8],
    grade: '2',
    classroomName: 'Grade 2B'
  });

  // Parent 2 should NOT see conv1 in their conversations
  const parent2Convs = getConversationsForUser({
    role: 'Parent',
    userId: parent2.id,
    grade: '2',
    classroom: db.classes[2],
    classes: db.classes
  });

  assert.ok(!parent2Convs.some(c => c.id === conv1.id), 'Parent 2 cannot see Parent 1 private conversation');
});
