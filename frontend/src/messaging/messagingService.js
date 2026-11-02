import { getParentForLearner, seedData, STORAGE_KEY } from '../dashboardData.js';

const MESSAGING_STORAGE_KEY = 'pula_messaging_v2';

function safeStorageGet(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function formatMessageTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString('en-ZA', { weekday: 'short' });
  } else {
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }
}

export function initMessagingStore() {
  const existing = safeStorageGet(MESSAGING_STORAGE_KEY, null);
  if (existing && Array.isArray(existing.conversations) && existing.conversations.length > 0) {
    return existing;
  }

  // Load from seedData or create defaults
  const seed = seedData();
  const store = {
    version: 2,
    conversations: seed.conversations || [],
    groups: seed.groups || [],
    groupInvitations: seed.groupInvitations || [],
    messages: seed.messages || []
  };

  safeStorageSet(MESSAGING_STORAGE_KEY, store);
  return store;
}

export function getMessagingStore() {
  return initMessagingStore();
}

export function saveMessagingStore(store) {
  safeStorageSet(MESSAGING_STORAGE_KEY, store);
}

// --------------------------------------------------------------------------
// Lesedi AI Assistant Draft Generator
// --------------------------------------------------------------------------
export function generateLesediDraft(category, learner, classroom, plannerItem = null) {
  const learnerName = learner ? (learner.name || 'Your child') : 'learners';
  const teacherName = classroom?.teacher || 'Teacher';
  const group = learner?.group || 'reading';
  const sounds = learner?.sounds?.join(', ') || 'ph, th';

  switch (category) {
    case 'Progress':
      return `Sawubona! ${learnerName} read with wonderful confidence in our ${group} group today. We are building steady reading habits. Reading one short page together for 10 minutes tonight will help solidify this progress. — ${teacherName}`;

    case 'Test':
      return plannerItem
        ? `Hello! A reminder that ${plannerItem.title} is coming up on ${plannerItem.date}. Please spend a few minutes practising with ${learnerName} each evening. — ${teacherName}`
        : `Hello! A reading check is coming up for our class this week. Please encourage ${learnerName} to read aloud at home and point to words as they read. — ${teacherName}`;

    case 'Exam':
      return `Dear Parent, our Term 4 assessments are approaching. ${learnerName} has shown commendable growth. Keeping a calm evening reading routine will support them best. — ${teacherName}`;

    case 'Spelling test':
      return `Sawubona! Our spelling and phonics focus this week includes sounds "${sounds}". Practising 5 simple words using these sounds with ${learnerName} tonight will be a great help. — ${teacherName}`;

    case 'Homework':
      return plannerItem
        ? `Reminder: ${plannerItem.title} is due tomorrow. Please check ${learnerName}'s workbook and spend 10 minutes reading together. — ${teacherName}`
        : `Reminder: Reading homework is due tomorrow. Please listen to ${learnerName} read page 12 aloud tonight. — ${teacherName}`;

    default:
      return `Hello! ${learnerName} is doing well with their reading practice. Thank you for your continued support at home. — ${teacherName}`;
  }
}

// --------------------------------------------------------------------------
// Core Messaging Queries & Actions
// --------------------------------------------------------------------------

export function getConversationsForUser({ role, userId, grade, classroom, classes }) {
  const store = getMessagingStore();
  const tId = role === 'Teacher' ? (userId || 'teacher-2') : null;
  const pId = role === 'Parent' ? (userId || 'parent-2-9') : null;

  if (role === 'Teacher') {
    // Teachers see private chats with parents of their classroom learners,
    // and groups belonging to their grade / where they are admin
    return store.conversations.filter(c => {
      if (c.grade && String(c.grade) !== String(grade)) return false;
      if (c.type === 'private') {
        return c.teacherId === tId || c.participantIds.includes(tId) || !c.teacherId;
      }
      if (c.type === 'group') {
        return c.teacherId === tId || c.participantIds.includes(tId);
      }
      return false;
    }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
  } else {
    // Parents see ONLY conversations they are an accepted participant of
    return store.conversations.filter(c => {
      if (c.type === 'private') {
        return c.parentId === pId || c.participantIds.includes(pId);
      }
      if (c.type === 'group') {
        // Parent must have accepted invitation
        return c.participantIds.includes(pId);
      }
      return false;
    }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
  }
}

export function getPendingInvitationsForParent(parentId) {
  const store = getMessagingStore();
  return store.groupInvitations.filter(inv => inv.parentId === parentId && inv.status === 'pending');
}

export function getGroupInvitationsForTeacher(teacherId, grade) {
  const store = getMessagingStore();
  return store.groupInvitations.filter(inv => {
    if (grade && String(inv.grade) !== String(grade)) return false;
    return inv.teacherId === teacherId;
  });
}

export function getConversationMessages(conversationId) {
  const store = getMessagingStore();
  return store.messages
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function sendMessage({ conversationId, senderId, senderName, senderRole, text, category = null }) {
  if (!text || !text.trim()) return null;
  const store = getMessagingStore();
  const conv = store.conversations.find(c => c.id === conversationId);
  if (!conv) throw new Error('Conversation not found');

  // Permission check for group onlyAdminCanSend
  if (conv.type === 'group' && conv.groupId) {
    const grp = store.groups.find(g => g.id === conv.groupId);
    if (grp?.onlyAdminCanSend && senderRole !== 'teacher') {
      throw new Error('Only the teacher can send messages in this group.');
    }
  }

  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    conversationId,
    senderId,
    senderName,
    senderRole,
    sender: senderRole,
    text: text.trim(),
    category,
    status: 'sent',
    createdAt: new Date().toISOString()
  };

  store.messages.push(newMsg);

  // Update conversation last message
  conv.lastMessage = newMsg.text;
  conv.lastMessageAt = newMsg.createdAt;

  if (!conv.unreadCount) conv.unreadCount = {};
  for (const pid of conv.participantIds) {
    if (pid !== senderId) {
      conv.unreadCount[pid] = (conv.unreadCount[pid] || 0) + 1;
    }
  }

  saveMessagingStore(store);

  // Async attempt to persist to Express API if available
  try {
    fetch(`/api/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId, senderName, senderRole, text: newMsg.text, category })
    }).catch(() => {});
  } catch {}

  return newMsg;
}

export function openOrCreatePrivateConversation({ teacherId, teacherName, learner, grade, classroomName }) {
  const store = getMessagingStore();
  const parent = getParentForLearner(learner, grade);
  const tId = teacherId || `teacher-${grade}`;
  const tName = teacherName || 'Teacher';

  // Check if private conversation already exists
  let conv = store.conversations.find(c =>
    c.type === 'private' &&
    c.learnerId === String(learner.id) &&
    (c.participantIds.includes(tId) || c.teacherId === tId)
  );

  if (!conv) {
    conv = {
      id: `conv-${learner.id}-${Date.now().toString(36)}`,
      type: 'private',
      title: `${learner.name}'s Parent`,
      subtitle: `${parent.name} · ${learner.group || 'Reading'} · ${classroomName || `Grade ${grade}`}`,
      grade: String(grade),
      classroom: classroomName || `Grade ${grade}`,
      learnerId: String(learner.id),
      parentId: parent.id,
      parentName: parent.name,
      teacherId: tId,
      teacherName: tName,
      participantIds: [tId, parent.id],
      lastMessage: 'Conversation opened',
      lastMessageAt: new Date().toISOString(),
      unreadCount: { [tId]: 0, [parent.id]: 0 },
      createdAt: new Date().toISOString()
    };
    store.conversations.unshift(conv);
    saveMessagingStore(store);

    try {
      fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId: learner.id, grade, teacherId: tId, teacherName: tName })
      }).catch(() => {});
    } catch {}
  }

  return conv;
}

export function createGroup({ name, description, grade, classroomName, teacherId, teacherName, learnerIds, onlyAdminCanSend, learnersList }) {
  if (!name || !name.trim()) throw new Error('Group name is required');
  if (!learnerIds || !learnerIds.length) throw new Error('Select at least one learner');

  const store = getMessagingStore();
  const tId = teacherId || `teacher-${grade}`;
  const tName = teacherName || 'Teacher';
  const groupId = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Find linked parents for learners and deduplicate
  const selectedParents = [];
  const seenParents = new Set();

  for (const lid of learnerIds) {
    const l = learnersList.find(x => String(x.id) === String(lid));
    if (l) {
      const p = getParentForLearner(l, grade);
      if (!seenParents.has(p.id)) {
        seenParents.add(p.id);
        selectedParents.push(p);
      }
    }
  }

  const group = {
    id: groupId,
    name: name.trim(),
    description: description?.trim() || `Communication between ${tName} and parents.`,
    creatorId: tId,
    teacherAdminId: tId,
    classroom: classroomName || `Grade ${grade}`,
    grade: String(grade),
    onlyAdminCanSend: Boolean(onlyAdminCanSend),
    createdAt: new Date().toISOString(),
    members: [
      { id: tId, name: `${tName} (Teacher)`, role: 'admin', status: 'accepted', joinedAt: new Date().toISOString() },
      ...selectedParents.map(p => ({
        id: p.id,
        name: `${p.name} (${p.learnerName.split(' ')[0]}'s ${p.relationship})`,
        learnerName: p.learnerName,
        role: 'member',
        status: 'pending',
        joinedAt: null
      }))
    ]
  };

  store.groups.unshift(group);

  const conv = {
    id: `conv-${groupId}`,
    type: 'group',
    groupId: group.id,
    title: group.name,
    subtitle: `1 member · ${classroomName || `Grade ${grade}`}`,
    grade: String(grade),
    classroom: classroomName || `Grade ${grade}`,
    teacherId: tId,
    teacherName: tName,
    participantIds: [tId], // Teacher only initially until parents accept
    lastMessage: `Group "${group.name}" created by ${tName}`,
    lastMessageAt: new Date().toISOString(),
    unreadCount: { [tId]: 0 },
    createdAt: new Date().toISOString()
  };

  store.conversations.unshift(conv);

  // Create pending invitations
  for (const p of selectedParents) {
    store.groupInvitations.unshift({
      id: `inv-${groupId}-${p.id}`,
      groupId: group.id,
      groupName: group.name,
      groupDescription: group.description,
      classroom: classroomName || `Grade ${grade}`,
      grade: String(grade),
      parentId: p.id,
      parentName: p.name,
      learnerName: p.learnerName,
      teacherId: tId,
      teacherName: tName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: null
    });
  }

  saveMessagingStore(store);

  try {
    fetch('/api/messages/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, grade, learnerIds, onlyAdminCanSend, teacherId: tId, teacherName: tName })
    }).catch(() => {});
  } catch {}

  return { group, conversation: conv };
}

export function respondToInvitation({ invitationId, parentId, action }) {
  const store = getMessagingStore();
  const inv = store.groupInvitations.find(i => i.id === invitationId);
  if (!inv) throw new Error('Invitation not found');

  inv.status = action === 'accept' ? 'accepted' : 'declined';
  inv.respondedAt = new Date().toISOString();

  const grp = store.groups.find(g => g.id === inv.groupId);
  if (grp) {
    const member = grp.members.find(m => m.id === parentId);
    if (member) {
      member.status = inv.status;
      if (action === 'accept') {
        member.joinedAt = inv.respondedAt;
      }
    }
  }

  const conv = store.conversations.find(c => c.groupId === inv.groupId);
  if (conv) {
    if (action === 'accept') {
      if (!conv.participantIds.includes(parentId)) {
        conv.participantIds.push(parentId);
      }
      const acceptedCount = (grp?.members || []).filter(m => m.status === 'accepted').length;
      conv.subtitle = `${acceptedCount} members · ${conv.classroom}`;
    } else {
      conv.participantIds = conv.participantIds.filter(id => id !== parentId);
    }
  }

  saveMessagingStore(store);

  try {
    fetch(`/api/messages/invitations/${invitationId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, action })
    }).catch(() => {});
  } catch {}

  return inv;
}

export function updateGroupSettings({ groupId, name, description, onlyAdminCanSend }) {
  const store = getMessagingStore();
  const grp = store.groups.find(g => g.id === groupId);
  if (!grp) throw new Error('Group not found');

  if (name) grp.name = name.trim();
  if (description !== undefined) grp.description = description.trim();
  if (onlyAdminCanSend !== undefined) grp.onlyAdminCanSend = Boolean(onlyAdminCanSend);

  const conv = store.conversations.find(c => c.groupId === groupId);
  if (conv && name) conv.title = grp.name;

  saveMessagingStore(store);

  try {
    fetch(`/api/messages/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, onlyAdminCanSend })
    }).catch(() => {});
  } catch {}

  return grp;
}

export function addGroupMembers({ groupId, learnerIds, learnersList, grade }) {
  const store = getMessagingStore();
  const grp = store.groups.find(g => g.id === groupId);
  if (!grp) throw new Error('Group not found');

  for (const lid of learnerIds) {
    const l = learnersList.find(x => String(x.id) === String(lid));
    if (l) {
      const p = getParentForLearner(l, grp.grade || grade);
      if (!grp.members.some(m => m.id === p.id)) {
        grp.members.push({
          id: p.id,
          name: `${p.name} (${p.learnerName.split(' ')[0]}'s ${p.relationship})`,
          learnerName: p.learnerName,
          role: 'member',
          status: 'pending',
          joinedAt: null
        });

        store.groupInvitations.unshift({
          id: `inv-${groupId}-${p.id}`,
          groupId: grp.id,
          groupName: grp.name,
          groupDescription: grp.description,
          classroom: grp.classroom,
          grade: grp.grade,
          parentId: p.id,
          parentName: p.name,
          learnerName: p.learnerName,
          teacherId: grp.teacherAdminId,
          teacherName: 'Teacher',
          status: 'pending',
          createdAt: new Date().toISOString(),
          respondedAt: null
        });
      }
    }
  }

  saveMessagingStore(store);

  try {
    fetch(`/api/messages/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerIds })
    }).catch(() => {});
  } catch {}

  return grp;
}

export function removeGroupMember({ groupId, memberId }) {
  const store = getMessagingStore();
  const grp = store.groups.find(g => g.id === groupId);
  if (!grp) throw new Error('Group not found');

  grp.members = grp.members.filter(m => m.id !== memberId);

  const conv = store.conversations.find(c => c.groupId === groupId);
  if (conv) {
    conv.participantIds = conv.participantIds.filter(id => id !== memberId);
    const acceptedCount = grp.members.filter(m => m.status === 'accepted').length;
    conv.subtitle = `${acceptedCount} members · ${conv.classroom}`;
  }

  saveMessagingStore(store);

  try {
    fetch(`/api/messages/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch {}

  return grp;
}

export function markConversationRead({ conversationId, userId }) {
  const store = getMessagingStore();
  const conv = store.conversations.find(c => c.id === conversationId);
  if (conv && conv.unreadCount && conv.unreadCount[userId]) {
    conv.unreadCount[userId] = 0;
    saveMessagingStore(store);
  }
}

