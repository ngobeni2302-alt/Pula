import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MoreVertical,
  ArrowLeft,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Users,
  UserPlus,
  MessageSquare,
  MessageCircle,
  Sparkles,
  Info,
  Shield,
  Clock,
  X,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Lock,
  ChevronRight,
  Smile
} from 'lucide-react';
import {
  formatMessageTime,
  getConversationsForUser,
  getPendingInvitationsForParent,
  getConversationMessages,
  sendMessage,
  openOrCreatePrivateConversation,
  createGroup,
  respondToInvitation,
  updateGroupSettings,
  addGroupMembers,
  removeGroupMember,
  markConversationRead,
  generateLesediDraft,
  getMessagingStore
} from './messagingService.js';
import { getParentForLearner } from '../dashboardData.js';
import './messaging.css';
import {coreApi,useCore} from '../core/CoreContext.jsx';

export default function MessagingHub({
  profile,
  classroom,
  classes = [],
  initialLearnerId = null,
  initialTopic = null,
  onNavigateHome
}) {
  const {workspace}=useCore();
  const [approvedSuggestions,setApprovedSuggestions]=useState([]);
  const isTeacher = profile?.role === 'Teacher';
  const currentGrade = String(classroom?.grade || profile?.grade || '2');
  const teacherId = `teacher-${currentGrade}`;
  const teacherName = classroom?.teacher || 'Teacher';

  // Current user ID: if Teacher, teacherId; if Parent, parentId based on childId
  const parentId = !isTeacher ? `parent-${profile?.childId || classroom?.learners?.[0]?.id || '2-9'}` : null;
  const currentUserId = isTeacher ? teacherId : parentId;
  const childLearner = !isTeacher
    ? (classroom?.learners?.find(l => l.id === profile?.childId) || classroom?.learners?.[0])
    : null;

  // View state: 'list' (on mobile) or 'chat' | 'contact-parent' | 'create-group' | 'group-info'
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('All'); // 'All' | 'Chats' | 'Groups'
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  // Sub-screens state
  const [contactSearch, setContactSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupOnlyAdmin, setGroupOnlyAdmin] = useState(false);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');

  // Lesedi AI Assistant Draft state
  const [lesediDraft, setLesediDraft] = useState(null);
  const [lesediTopic, setLesediTopic] = useState(null);

  // Notice banner
  const [notice, setNotice] = useState('');

  const messagesEndRef = useRef(null);

  // Resize listener for desktop split-view
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Poll / Sync data every 2 seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 2000);
    const handleStorage = e => {
      if (e.key === 'pula_messaging_v2') setTick(t => t + 1);
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Learners list for current classroom
  const learners = classroom?.learners || [];

  // Conversations accessible to current user
  const allConversations = getConversationsForUser({
    role: profile?.role,
    userId: currentUserId,
    grade: currentGrade,
    classroom,
    classes
  });

  // Pending invitations for parent
  const pendingInvitations = !isTeacher ? getPendingInvitationsForParent(currentUserId) : [];

  // Filter conversations by tab and search
  const filteredConversations = allConversations.filter(c => {
    if (tab === 'Chats' && c.type !== 'private') return false;
    if (tab === 'Groups' && c.type !== 'group') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchSubtitle = (c.subtitle || '').toLowerCase().includes(q);
      const matchLastMsg = (c.lastMessage || '').toLowerCase().includes(q);
      return matchTitle || matchSubtitle || matchLastMsg;
    }
    return true;
  });

  // Handle initial learner/topic passed from Planner or Groups
  useEffect(() => {
    if (initialLearnerId) {
      const targetLearner = learners.find(l => l.id === initialLearnerId) || classroom?.learners?.find(l => l.id === initialLearnerId);
      if (targetLearner) {
        const conv = openOrCreatePrivateConversation({
          teacherId,
          teacherName,
          learner: targetLearner,
          grade: currentGrade,
          classroomName: classroom?.name || (classroom?.room ? `Grade ${classroom.room}` : `Grade ${currentGrade}`)
        });
        setActiveConversation(conv);
        setView('chat');

        if (isTeacher && initialTopic) {
          const draft = generateLesediDraft(initialTopic, targetLearner, classroom);
          setLesediTopic(initialTopic);
          setLesediDraft(draft);
        }
      }
    }
  }, [initialLearnerId, initialTopic]);

  useEffect(()=>{
    let active=true;setApprovedSuggestions([]);
    const learner=workspace?.classes.flatMap(c=>c.learners).find(l=>l.legacyId===activeConversation?.learnerId||l.id===activeConversation?.learnerId);
    if(isTeacher&&workspace?.account.role==='teacher'&&learner)coreApi(`/suggestions?learnerId=${encodeURIComponent(learner.id)}`).then(s=>{if(active)setApprovedSuggestions(s);}).catch(()=>{});
    try {setInputText(localStorage.getItem(`pula_chat_draft_${currentUserId}_${activeConversation?.id}`)||'');}catch{}
    return()=>{active=false;};
  },[activeConversation?.id,workspace]);

  // Load messages when active conversation changes or ticks
  useEffect(() => {
    if (activeConversation) {
      const msgs = getConversationMessages(activeConversation.id);
      setMessages(msgs);
      markConversationRead({ conversationId: activeConversation.id, userId: currentUserId });
    }
  }, [activeConversation?.id, tick]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleSelectConversation = conv => {
    setActiveConversation(conv);
    setView('chat');
    setLesediDraft(null);
    setLesediTopic(null);
    setMenuOpen(false);
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeConversation) return;

    try {
      const senderName = isTeacher
        ? teacherName
        : (getParentForLearner(learners.find(l => `parent-${l.id}` === currentUserId), currentGrade)?.name || 'Parent');

      sendMessage({
        conversationId: activeConversation.id,
        senderId: currentUserId,
        senderName,
        senderRole: isTeacher ? 'teacher' : 'parent',
        text: inputText.trim()
      });

      setInputText('');
      setTick(t => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenContactParent = () => {
    setView('contact-parent');
    setMenuOpen(false);
  };

  const handleOpenCreateGroup = () => {
    setView('create-group');
    setGroupName('');
    setGroupDesc('');
    setGroupOnlyAdmin(false);
    setSelectedLearnerIds([]);
    setMenuOpen(false);
  };

  const handleParentMessageTeacher = () => {
    setMenuOpen(false);
    if (!childLearner) return;

    const conv = openOrCreatePrivateConversation({
      teacherId,
      teacherName,
      learner: childLearner,
      grade: currentGrade,
      classroomName: classroom?.name || (classroom?.room ? `Grade ${classroom.room}` : `Grade ${currentGrade}`)
    });
    setActiveConversation(conv);
    setView('chat');
    setTick(t => t + 1);
  };

  const getConversationDisplayDetails = (conv) => {
    if (!conv) return { title: '', subtitle: '', initials: '?' };
    const isGroup = conv.type === 'group';
    if (isGroup) {
      return {
        title: conv.title,
        subtitle: conv.subtitle || 'Classroom Group',
        initials: 'GP'
      };
    }
    if (!isTeacher) {
      const tName = conv.teacherName || teacherName;
      const cRoom = conv.classroom || (classroom?.room ? `Grade ${classroom.room}` : `Grade ${currentGrade}`);
      const lName = childLearner?.name || 'Child';
      return {
        title: `${tName} (${cRoom})`,
        subtitle: `${lName}'s Teacher · ${cRoom}`,
        initials: (tName.match(/\b(\w)/g) || ['T']).slice(0, 2).join('').toUpperCase()
      };
    }
    return {
      title: conv.title,
      subtitle: conv.subtitle || 'Private chat',
      initials: (conv.title?.match(/\b(\w)/g) || ['P']).slice(0, 2).join('').toUpperCase()
    };
  };

  const handleLearnerContactSelected = learner => {
    const conv = openOrCreatePrivateConversation({
      teacherId,
      teacherName,
      learner,
      grade: currentGrade,
      classroomName: classroom?.name || `Grade ${currentGrade}`
    });
    setActiveConversation(conv);
    setView('chat');
    setLesediDraft(null);
  };

  const handleCreateGroupSubmit = e => {
    e.preventDefault();
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }
    if (selectedLearnerIds.length === 0) {
      alert('Please select at least one learner');
      return;
    }

    try {
      const { group, conversation } = createGroup({
        name: groupName.trim(),
        description: groupDesc.trim(),
        grade: currentGrade,
        classroomName: classroom?.name || `Grade ${currentGrade}`,
        teacherId,
        teacherName,
        learnerIds: selectedLearnerIds,
        onlyAdminCanSend: groupOnlyAdmin,
        learnersList: learners
      });

      setActiveConversation(conversation);
      setView('chat');
      setNotice(`Group "${group.name}" created and invitations sent to parents.`);
      setTick(t => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRespondInvitation = (invitationId, action) => {
    try {
      respondToInvitation({
        invitationId,
        parentId: currentUserId,
        action
      });
      setNotice(action === 'accept' ? 'You joined the group!' : 'Invitation declined.');
      setTick(t => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  // Lesedi Draft Trigger
  const handleTriggerLesedi = category => {
    const targetLearner = activeConversation?.learnerId
      ? learners.find(l => String(l.id) === String(activeConversation.learnerId))
      : null;
    const draft = generateLesediDraft(category, targetLearner, classroom);
    setLesediTopic(category);
    setLesediDraft(draft);
  };

  const handleApproveLesediDraft = () => {
    if (!lesediDraft || !lesediDraft.trim() || !activeConversation) return;

    sendMessage({
      conversationId: activeConversation.id,
      senderId: currentUserId,
      senderName: teacherName,
      senderRole: 'teacher',
      text: lesediDraft.trim(),
      category: lesediTopic
    });

    setLesediDraft(null);
    setLesediTopic(null);
    setTick(t => t + 1);
    setNotice('Approved and sent message.');
  };

  // Group Info / Management
  const currentGroup = activeConversation?.type === 'group' && activeConversation.groupId
    ? (getMessagingStore().groups.find(g => g.id === activeConversation.groupId) || null)
    : null;

  const handleToggleOnlyAdmin = () => {
    if (!currentGroup || !isTeacher) return;
    updateGroupSettings({
      groupId: currentGroup.id,
      onlyAdminCanSend: !currentGroup.onlyAdminCanSend
    });
    setTick(t => t + 1);
  };

  const handleRemoveMember = memberId => {
    if (!currentGroup || !isTeacher) return;
    if (window.confirm('Remove this member from the group?')) {
      removeGroupMember({ groupId: currentGroup.id, memberId });
      setTick(t => t + 1);
    }
  };

  const handleLeaveGroup = () => {
    if (!currentGroup || isTeacher) return;
    if (window.confirm('Leave this group? You will no longer receive group messages.')) {
      removeGroupMember({ groupId: currentGroup.id, memberId: currentUserId });
      setActiveConversation(null);
      setView('list');
      setTick(t => t + 1);
    }
  };

  // --------------------------------------------------------------------------
  // Sub-Renderers
  // --------------------------------------------------------------------------

  // Left Pane: Conversation List & Header
  const renderConversationList = () => (
    <div className="msg-pane-left">
      {/* Top Header */}
      <div className="msg-main-header">
        <div>
          <h1>Messages</h1>
          <small style={{ color: 'var(--msg-text-muted)', fontSize: '11px', fontWeight: 700 }}>
            {isTeacher ? `${teacherName} · Grade ${currentGrade}` : `${profile?.role || 'Parent'} Workspace`}
          </small>
        </div>

        {/* Top-Right Menu for Teachers and Parents */}
        <div className="msg-header-actions">
          <button
            className="msg-icon-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            title="Menu options"
            aria-label="Options"
          >
            <MoreVertical size={20} />
          </button>

          {menuOpen && (
            <div className="msg-dropdown-menu">
              {isTeacher ? (
                <>
                  <button
                    className="msg-dropdown-item"
                    onClick={handleOpenContactParent}
                  >
                    <UserPlus size={16} /> Contact Parent
                  </button>
                  <button
                    className="msg-dropdown-item"
                    onClick={handleOpenCreateGroup}
                  >
                    <Users size={16} /> Create Group
                  </button>
                  <button
                    className="msg-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      document.getElementById('msg-search-input')?.focus();
                    }}
                  >
                    <Search size={16} /> Search Contacts
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="msg-dropdown-item"
                    onClick={handleParentMessageTeacher}
                  >
                    <MessageCircle size={16} /> Message Teacher ({teacherName} · Grade {classroom?.room || currentGrade})
                  </button>
                  <button
                    className="msg-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      document.getElementById('msg-search-input')?.focus();
                    }}
                  >
                    <Search size={16} /> Search Messages
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div style={{ background: 'var(--pula-lavender)', padding: '8px 16px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{notice}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setNotice('')}><X size={14}/></button>
        </div>
      )}

      {/* Search Bar */}
      <div className="msg-search-bar">
        <div className="msg-search-input-wrap">
          <Search size={16} style={{ color: 'var(--msg-text-muted)' }} />
          <input
            id="msg-search-input"
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs: All | Chats | Groups */}
      <div className="msg-tabs">
        {['All', 'Chats', 'Groups'].map(t => (
          <button
            key={t}
            className={`msg-tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Groups' && pendingInvitations.length > 0 && (
              <span className="msg-tab-badge">{pendingInvitations.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Invitations Banner for Parent */}
      {!isTeacher && (tab === 'All' || tab === 'Groups') && pendingInvitations.length > 0 && (
        <div className="msg-invitations-section">
          {pendingInvitations.map(inv => (
            <div key={inv.id} className="msg-invitation-card">
              <span className="msg-invitation-badge">
                <Sparkles size={12} /> Group Invitation
              </span>
              <h3>{inv.groupName}</h3>
              <p>
                <strong>{inv.teacherName}</strong> has invited you to join this classroom group for{' '}
                {inv.learnerName}.
                {inv.groupDescription && <span style={{ display: 'block', marginTop: '4px' }}>"{inv.groupDescription}"</span>}
              </p>
              <div className="msg-invitation-actions">
                <button
                  className="msg-btn-accept"
                  onClick={() => handleRespondInvitation(inv.id, 'accept')}
                >
                  <Check size={14} /> Accept Invitation
                </button>
                <button
                  className="msg-btn-decline"
                  onClick={() => handleRespondInvitation(inv.id, 'decline')}
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversation Rows List */}
      <div className="msg-conv-list">
        {filteredConversations.length === 0 ? (
          <div className="msg-empty-list">
            <MessageCircle size={36} style={{ color: 'var(--msg-text-muted)', marginBottom: '8px' }} />
            <h3>No conversations found</h3>
            <p>
              {isTeacher
                ? 'Use the ⋮ menu in the top-right to contact a parent or create a group.'
                : 'Your teacher will reach out or invite you to classroom groups.'}
            </p>
            {isTeacher && (
              <button
                className="pd-primary"
                style={{ padding: '10px 16px', minHeight: '38px', fontSize: '13px' }}
                onClick={handleOpenContactParent}
              >
                <UserPlus size={15} /> Contact Parent
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map(conv => {
            const isGroup = conv.type === 'group';
            const isActive = activeConversation?.id === conv.id;
            const unread = conv.unreadCount?.[currentUserId] || 0;
            const { title: convTitle, subtitle: convSubtitle, initials } = getConversationDisplayDetails(conv);

            return (
              <button
                key={conv.id}
                className={`msg-conv-row ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv)}
              >
                <div className={`msg-avatar ${isGroup ? 'group-avatar' : ''}`}>
                  {isGroup ? <Users size={20} /> : initials}
                </div>

                <div className="msg-conv-info">
                  <div className="msg-conv-top">
                    <span className="msg-conv-title">{convTitle}</span>
                    <span className="msg-conv-time">{formatMessageTime(conv.lastMessageAt || conv.createdAt)}</span>
                  </div>

                  <div className="msg-conv-bottom">
                    <span className="msg-conv-snippet">
                      <span className="msg-double-tick"><CheckCheck size={13} /></span>
                      {conv.lastMessage || 'No messages yet'}
                    </span>
                    {unread > 0 && <span className="msg-unread-badge">{unread}</span>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // Right Pane: Active Chat Screen
  const renderChatView = () => {
    if (!activeConversation) {
      return (
        <div className="msg-desktop-empty">
          <MessageSquare size={48} style={{ color: 'var(--msg-text-muted)' }} />
          <h3>Select a conversation</h3>
          <p>Choose a parent chat or group from the left to start messaging.</p>
        </div>
      );
    }

    const isGroup = activeConversation.type === 'group';
    const isRestrictedGroup = isGroup && currentGroup?.onlyAdminCanSend && !isTeacher;
    const activeDisplay = getConversationDisplayDetails(activeConversation);

    return (
      <div className="msg-chat-pane msg-enhanced-conversation">
        {/* Chat Header */}
        <div className="msg-chat-header">
          {!isDesktop && (
            <button className="msg-icon-btn" onClick={() => setView('list')} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}

          <div
            className={`msg-avatar ${isGroup ? 'group-avatar' : ''}`}
            style={{ width: '40px', height: '40px', fontSize: '13px' }}
          >
            {isGroup ? <Users size={18} /> : activeDisplay.initials}
          </div>

          <div
            className="msg-chat-header-info"
            onClick={() => isGroup && setView('group-info')}
            title={isGroup ? 'Click for group details' : ''}
          >
            <h2>{activeDisplay.title}</h2>
            <small>{activeDisplay.subtitle}</small>
            <small>Home language: {learners.find(l=>l.id===activeConversation.learnerId)?.language||'Not recorded'} · Translation not connected</small>
          </div>

          {isGroup && (
            <button
              className="msg-icon-btn"
              onClick={() => setView('group-info')}
              title="Group info"
            >
              <Info size={19} />
            </button>
          )}
        </div>

        {/* Message Thread */}
        <div className="msg-messages-thread">
          <div className="msg-date-separator">
            <span>Device-local demo conversation · external delivery not connected</span>
          </div>

          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--msg-text-muted)', fontSize: '13px' }}>
              No messages yet in this conversation. Say hello!
            </div>
          ) : (
            messages.map(m => {
              // Message is considered "teacher-sent" if senderRole is teacher
              const isTeacherMsg = m.senderRole === 'teacher';
              const isMyMsg = m.senderId === currentUserId;

              return (
                <div
                  key={m.id}
                  className={`msg-bubble-wrap ${isTeacherMsg ? 'teacher-sent' : 'parent-sent'}`}
                >
                  <div className="msg-bubble">
                    {/* In group chats, display sender's name above incoming messages */}
                    {isGroup && !isMyMsg && (
                      <div className="msg-sender-tag">{m.senderName}</div>
                    )}

                    <p style={{ margin: 0 }}>{m.text}</p>

                    <div className="msg-bubble-footer">
                      <span className="msg-timestamp">
                        {new Date(m.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMyMsg && (
                        <span className="msg-double-tick">
                          <CheckCheck size={13} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {isTeacher&&approvedSuggestions.length>0&&<section className="msg-approved-tips"><strong>Lesedi suggestions · from teacher-approved assessments</strong>{approvedSuggestions.map(s=><div key={s.id}><p>{s.text}</p><button onClick={()=>setInputText(t=>[t,s.text].filter(Boolean).join(' '))}>Add</button></div>)}<small>Add inserts text into the composer. Review it before sending.</small></section>}
        {!isTeacher&&<div className="msg-quick-replies">{['Thank you.','Can we talk?','My child is unwell today.'].map(text=><button key={text} onClick={()=>setInputText(text)}>{text}</button>)}</div>}
        {activeConversation&&<button className="msg-save-draft" onClick={()=>{try{localStorage.setItem(`pula_chat_draft_${currentUserId}_${activeConversation.id}`,inputText);setNotice('Composer saved as a draft on this device.');}catch{setNotice('Draft could not be saved.');}}}>Save composer draft</button>}
        {/* Lesedi AI Assistant Drawer for Teachers */}
        {isTeacher && (
          <div className="msg-lesedi-bar">
            <div className="msg-lesedi-title">
              <Sparkles size={13} /> Lesedi Quick Assistant · Tap to draft
            </div>
            <div className="msg-lesedi-chips">
              {['Progress', 'Test', 'Exam', 'Spelling test', 'Homework'].map(cat => (
                <button
                  key={cat}
                  className="msg-lesedi-chip"
                  onClick={() => handleTriggerLesedi(cat)}
                >
                  <span>+</span> {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lesedi Draft Review Box (Teacher must approve before sending) */}
        {lesediDraft !== null && (
          <div className="msg-draft-review-box">
            <div className="msg-draft-header">
              <strong>
                <Sparkles size={14} /> Lesedi draft ({lesediTopic}) · Review before approving
              </strong>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setLesediDraft(null)}
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              className="msg-draft-textarea"
              value={lesediDraft}
              onChange={e => setLesediDraft(e.target.value)}
              placeholder="Edit draft before sending..."
            />
            <div className="msg-draft-actions">
              <button className="msg-draft-btn-cancel" onClick={() => setLesediDraft(null)}>
                Discard
              </button>
              <button className="msg-draft-btn-send" onClick={handleApproveLesediDraft}>
                <Check size={14} /> Approve & Send
              </button>
            </div>
          </div>
        )}

        {/* Chat Input Bar */}
        {isRestrictedGroup ? (
          <div className="msg-chat-blocked-banner">
            <Lock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Only the teacher administrator can send messages in this group.
          </div>
        ) : (
          <div className="msg-input-bar">
            <button
              className="msg-icon-btn"
              title="Add attachment (simulated)"
              onClick={() => alert('Attachments: Voice note, Reading Card, or Worksheet can be shared here.')}
            >
              <Paperclip size={18} />
            </button>

            <input
              type="text"
              className="msg-input-field"
              placeholder={isTeacher ? 'Type a message to parent...' : 'Write to your teacher...'}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />

            <button
              className="msg-send-btn"
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Sub-screen: Contact Parent (Teachers only)
  const renderContactParent = () => {
    const filteredLearners = learners.filter(l => {
      const q = contactSearch.toLowerCase();
      const parent = getParentForLearner(l, currentGrade);
      return (
        l.name.toLowerCase().includes(q) ||
        parent.name.toLowerCase().includes(q) ||
        (l.group || '').toLowerCase().includes(q)
      );
    });

    return (
      <div className="msg-subscreen">
        <div className="msg-subscreen-header">
          <button className="msg-icon-btn" onClick={() => setView('list')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2>Contact Parent</h2>
            <small style={{ color: 'var(--msg-text-muted)' }}>
              Select a learner from your classroom ({classroom?.name || `Grade ${currentGrade}`})
            </small>
          </div>
        </div>

        <div className="msg-search-bar" style={{ borderBottom: '1px solid var(--msg-border)' }}>
          <div className="msg-search-input-wrap">
            <Search size={16} style={{ color: 'var(--msg-text-muted)' }} />
            <input
              type="text"
              placeholder="Search learner or parent name..."
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="msg-subscreen-content">
          <p style={{ fontSize: '12px', color: 'var(--msg-text-muted)', marginBottom: '12px' }}>
            Parents are linked automatically from class records. Selecting a learner opens a direct, secure conversation with their registered guardian.
          </p>

          {filteredLearners.map(learner => {
            const parent = getParentForLearner(learner, currentGrade);
            return (
              <button
                key={learner.id}
                className="msg-contact-card"
                onClick={() => handleLearnerContactSelected(learner)}
              >
                <div className="msg-contact-details">
                  <b>{parent.learnerName}</b>
                  <span>
                    Linked Guardian: <strong>{parent.name}</strong> ({parent.relationship})
                  </span>
                  <span>Class: Grade {currentGrade} · Reading group: {learner.group}</span>
                </div>
                <span className={`msg-tier-badge ${learner.group}`}>{learner.group}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Sub-screen: Create Group (Teachers only)
  const renderCreateGroup = () => {
    // Unique parents preview for selected learners
    const selectedParentsMap = new Map();
    for (const lid of selectedLearnerIds) {
      const l = learners.find(x => String(x.id) === String(lid));
      if (l) {
        const p = getParentForLearner(l, currentGrade);
        if (!selectedParentsMap.has(p.id)) {
          selectedParentsMap.set(p.id, { parent: p, learners: [l.name] });
        } else {
          selectedParentsMap.get(p.id).learners.push(l.name);
        }
      }
    }
    const uniqueParents = Array.from(selectedParentsMap.values());

    const toggleLearner = lid => {
      setSelectedLearnerIds(prev =>
        prev.includes(lid) ? prev.filter(x => x !== lid) : [...prev, lid]
      );
    };

    const handleSelectAll = () => {
      setSelectedLearnerIds(learners.map(l => l.id));
    };

    const handleClearAll = () => {
      setSelectedLearnerIds([]);
    };

    return (
      <div className="msg-subscreen">
        <div className="msg-subscreen-header">
          <button className="msg-icon-btn" onClick={() => setView('list')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2>Create Group</h2>
            <small style={{ color: 'var(--msg-text-muted)' }}>
              Invite parents from Grade {currentGrade}
            </small>
          </div>
        </div>

        <form className="msg-subscreen-content" onSubmit={handleCreateGroupSubmit}>
          <div className="msg-form-group">
            <label>Group Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Grade 2 Parents or Sprout Reading Circle"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>

          <div className="msg-form-group">
            <label>Group Description (optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Communication regarding weekly reading rounds and classroom homework."
              value={groupDesc}
              onChange={e => setGroupDesc(e.target.value)}
            />
          </div>

          <div className="msg-form-group">
            <label className="msg-checkbox-row">
              <input
                type="checkbox"
                checked={groupOnlyAdmin}
                onChange={e => setGroupOnlyAdmin(e.target.checked)}
              />
              <span>Only teacher administrator can send messages</span>
            </label>
          </div>

          <div className="msg-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ margin: 0 }}>Select Learners to Invite Parents ({selectedLearnerIds.length}/{learners.length})</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="pd-link" style={{ padding: 0 }} onClick={handleSelectAll}>Select all</button>
                <button type="button" className="pd-link" style={{ padding: 0 }} onClick={handleClearAll}>Clear</button>
              </div>
            </div>

            <div className="msg-learners-picker">
              {learners.map(l => {
                const p = getParentForLearner(l, currentGrade);
                const isChecked = selectedLearnerIds.includes(l.id);
                return (
                  <label key={l.id} className="msg-picker-item">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleLearner(l.id)}
                    />
                    <div>
                      <b style={{ fontSize: '13px', display: 'block' }}>{p.learnerName}</b>
                      <small style={{ fontSize: '11px', color: 'var(--msg-text-muted)' }}>
                        Linked Parent: {p.name} ({p.relationship}) · {l.group}
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {uniqueParents.length > 0 && (
            <div style={{ background: '#f5eedf', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px' }}>
              <b>{uniqueParents.length} parent invitation{uniqueParents.length === 1 ? '' : 's'} will be sent:</b>
              <p style={{ margin: '4px 0 0', color: 'var(--pula-navy)' }}>
                {uniqueParents.map(u => `${u.parent.name} (${u.learners.join(', ')})`).join('; ')}
              </p>
            </div>
          )}

          <div className="msg-create-group-footer">
            <button
              type="submit"
              className="pd-primary pd-full"
              disabled={!groupName.trim() || selectedLearnerIds.length === 0}
            >
              <Check size={16} /> Create Group & Send Invitations
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Sub-screen: Group Info & Management
  const renderGroupInfo = () => {
    if (!currentGroup) return null;

    return (
      <div className="msg-subscreen">
        <div className="msg-subscreen-header">
          <button className="msg-icon-btn" onClick={() => setView('chat')}>
            <ArrowLeft size={18} />
          </button>
          <h2>Group Information</h2>
        </div>

        <div className="msg-subscreen-content">
          <div className="msg-group-info-header">
            <div className="msg-avatar group-avatar" style={{ width: '64px', height: '64px', margin: '0 auto 10px' }}>
              <Users size={32} />
            </div>
            <h2>{currentGroup.name}</h2>
            <p>{currentGroup.description}</p>
            <small style={{ display: 'block', marginTop: '6px', color: 'var(--msg-text-muted)' }}>
              Created {new Date(currentGroup.createdAt).toLocaleDateString('en-ZA')} · {currentGroup.classroom}
            </small>
          </div>

          {/* Teacher Group Settings */}
          {isTeacher && (
            <div style={{ background: '#fcfaf5', border: '1px solid var(--msg-border)', borderRadius: '16px', padding: '14px', margin: '16px 0' }}>
              <b style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>Teacher Administrator Controls</b>
              <label className="msg-checkbox-row">
                <input
                  type="checkbox"
                  checked={currentGroup.onlyAdminCanSend}
                  onChange={handleToggleOnlyAdmin}
                />
                <span>Only teacher can send messages in this group</span>
              </label>
            </div>
          )}

          {/* Members List */}
          <div className="msg-members-list">
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '10px 0 8px' }}>
              Group Members ({currentGroup.members.length})
            </h3>

            {currentGroup.members.map(member => (
              <div key={member.id} className="msg-member-row">
                <div>
                  <b style={{ fontSize: '13.5px', display: 'block' }}>{member.name}</b>
                  <small style={{ color: 'var(--msg-text-muted)', fontSize: '11px' }}>
                    {member.role === 'admin' ? 'Teacher (Admin)' : 'Parent Member'}
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`msg-status-pill ${member.status}`}>
                    {member.status === 'accepted' ? 'Accepted' : member.status === 'declined' ? 'Declined' : 'Pending'}
                  </span>

                  {isTeacher && member.role !== 'admin' && (
                    <button
                      className="msg-icon-btn"
                      title="Remove member"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <Trash2 size={15} style={{ color: '#883120' }} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Parent: Leave Group Option */}
          {!isTeacher && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                className="pd-link"
                style={{ color: '#883120' }}
                onClick={handleLeaveGroup}
              >
                Leave this group
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // Main Render Routing
  // --------------------------------------------------------------------------

  return (
    <div className={`msg-wrapper ${isDesktop ? 'desktop-split' : ''}`}>
      {/* If Desktop: Left pane is always conversation list (or subscreen), right pane is active chat */}
      {isDesktop ? (
        <>
          {view === 'contact-parent'
            ? renderContactParent()
            : view === 'create-group'
            ? renderCreateGroup()
            : view === 'group-info'
            ? renderGroupInfo()
            : renderConversationList()}

          <div className="msg-pane-right">
            {renderChatView()}
          </div>
        </>
      ) : (
        /* If Mobile: Switch between single full-screen views */
        <>
          {view === 'list' && renderConversationList()}
          {view === 'chat' && renderChatView()}
          {view === 'contact-parent' && renderContactParent()}
          {view === 'create-group' && renderCreateGroup()}
          {view === 'group-info' && renderGroupInfo()}
        </>
      )}
    </div>
  );
}

