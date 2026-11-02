export const GROUPS = ['Seed', 'Sprout', 'Bloom', 'Tree'];
export const TOPICS = ['Progress', 'Test', 'Exam', 'Spelling test', 'Homework'];
export const PLANS = [
  {grade:'R', teacher:'Ma’am Elise', room:'RB', counts:[9,12,8,5], heard:6, focus:'Listen, talk and play', description:'Listening, speaking and early literacy through songs, rhymes and stories.', steps:['Use songs, rhymes and stories every day.','Keep letter-sound and number games short and playful.','Give every child a chance to speak each week.'], resources:['Rhyme and song set','Letter-sound cards, set 1','Counting with bottle tops','Story time prompts'], work:['Letter sounds','Story chat at home','Rhyme time']},
  {grade:'1', teacher:'Grade 1 teacher', room:'1A', counts:[10,13,8,5], heard:12, focus:'Sounds into words', description:'Letter sounds, blending and the first common sight words.', steps:['Teach letter sounds, then blend short words.','Build a small bank of common sight words each week.','Read aloud daily and invite children to join in.'], resources:['Sound blending cards','Sight words list, set 1','Read-aloud picture book prompts','Number bonds to 10'], work:['Number check','Read page 8','Word set 3']},
  {grade:'2', teacher:'Sir Iak', room:'2B', counts:[8,12,11,7], heard:9, focus:'Phonics and shared reading', description:'Phonics, sight words, Big Book reading and small-group guided reading.', steps:['Phonics for 15 minutes, four days a week.','Shared Big Book reading for 20 minutes, three days a week.','Guided reading in two small groups, five days a week.'], resources:['Sound hunt: th and sh','Sight words list, set 3','Big Book shared reading guide','Add to 10 on a number line'], work:['Maths: add to 10','Read page 12 aloud','Word set 4']},
  {grade:'3', teacher:'Grade 3 teacher', room:'3C', counts:[6,11,13,10], heard:15, focus:'Reading for meaning', description:'Short stories, spelling sets and paired reading every day.', steps:['Read short stories and discuss what happened.','Practise a new spelling set each week.','Use paired reading so each child reads aloud daily.'], resources:['Comprehension questions, set 2','Spelling word set 6','Paired reading routine','Number patterns game'], work:['Reading test','Write 3 sentences','Word set 6']}
];
export const STORAGE_KEY = 'pula_dashboards_v1';

export const SURNAMES = ['Mokoena', 'Dlamini', 'Nkosi', 'Patel', 'Modise', 'Molefe', 'Sithole', 'Khumalo', 'Ndlovu', 'Botha', 'Naidoo', 'Van der Merwe'];
export const GUARDIAN_FIRST_NAMES = ['Nomsa', 'Kagiso', 'Busisiwe', 'Fatima', 'Tebogo', 'Palesa', 'Siphiwe', 'Lindiwe', 'Bongani', 'Zandile', 'Anil', 'Johan'];
export const RELATIONSHIPS = ['Mother', 'Father', 'Mother', 'Father', 'Guardian', 'Mother', 'Aunt', 'Father'];

export function getParentForLearner(learner, grade = '2') {
  if (!learner) return { id: 'parent-demo', name: "Thando's Parent", relationship: 'Parent', learnerId: 'demo', learnerName: 'Learner', grade: String(grade) };
  if (learner.name?.startsWith('Thando')) {
    return {
      id: `parent-${learner.id}`,
      name: 'Nomsa Mokoena',
      relationship: 'Mother',
      learnerId: String(learner.id),
      learnerName: 'Thando Mokoena',
      grade: String(grade),
      classroom: `Grade ${grade}`,
      channel: 'WhatsApp'
    };
  }
  if (learner.name?.startsWith('Lerato')) {
    return {
      id: `parent-${learner.id}`,
      name: 'Kagiso Dlamini',
      relationship: 'Father',
      learnerId: String(learner.id),
      learnerName: 'Lerato Dlamini',
      grade: String(grade),
      classroom: `Grade ${grade}`,
      channel: 'SMS'
    };
  }
  const numId = parseInt(String(learner.id).replace(/\D/g, '') || '1', 10);
  const surname = SURNAMES[(numId - 1) % SURNAMES.length];
  const firstName = GUARDIAN_FIRST_NAMES[(numId - 1) % GUARDIAN_FIRST_NAMES.length];
  const relationship = RELATIONSHIPS[(numId - 1) % RELATIONSHIPS.length];
  const learnerFullName = learner.name.includes(' ') ? learner.name : `${learner.name} ${surname}`;
  const parentName = `${firstName} ${surname}`;
  const parentId = `parent-${learner.id}`;
  return {
    id: parentId,
    name: parentName,
    relationship,
    learnerId: String(learner.id),
    learnerName: learnerFullName,
    grade: String(grade),
    classroom: `Grade ${grade}`,
    channel: 'WhatsApp'
  };
}

export function seedData() {
  const classes = PLANS.map((p, index) => {
    let n=0;
    const learners=p.counts.flatMap((count,g)=>Array.from({length:count},(_,i)=>{
      const id=`${p.grade}-${++n}`;
      const name=['Thando','Lerato','Sipho','Aisha','Kabelo','Naledi'][n-1] || `Learner ${n}`;
      const base=8+g*9+index*3+i%4;
      return {id,name,group:GROUPS[g],code:Math.min(7,1+g*2+i%2),history:[base,base+6,base+13,base+20],sounds:p.grade==='R'?['s','m']:['th','sh'],strategy:'Guided reading for 10 minutes daily',review:'2026-11-13',consent:name==='Palesa'?false:true};
    }));
    if(p.grade==='2') {
      Object.assign(learners[8],{name:'Thando',history:[18,24,31,38],consent:true});
      learners[0].name='Zanele';
      if(learners[6]) learners[6].name='Ruan';
      if(learners[7]) { learners[7].name='Palesa'; learners[7].consent=false; }
      if(learners[9]) learners[9].name='Neo';
      if(learners[10]) learners[10].name='Amahle';
      if(learners[11]) learners[11].name='Tumi';
    }
    learners[2].history=[12,15,16,16];
    learners[3].history=[24,26,25,22];
    return {...p,learners,assessedIds:p.grade==='2'?[learners[1].id, learners[4].id]:[],logs:[true,true,false,false],previousAverage:index===3?41:24,items:[
      {id:`${p.grade}-hw`,type:'Homework',title:p.work[1],date:'2026-11-02',detail:'Spend 10 minutes together.',told:false},
      {id:`${p.grade}-test`,type:'Test',title:p.work[0],date:'2026-11-04',detail:'Practise a little each evening.',told:false},
      {id:`${p.grade}-spell`,type:'Spelling test',title:p.work[2],date:'2026-11-06',detail:p.grade==='R'?'Practise rhymes together.':'Practise five words a night.',told:false},
      {id:`${p.grade}-exam`,type:'Exam',title:'Term 4 assessment',date:'2026-11-23',detail:'Timetable will follow.',told:false}
    ]};
  });
  const child=classes[2].learners[8];
  const thandoParent = getParentForLearner(child, '2');
  const leratoChild = classes[2].learners[1];
  const leratoParent = getParentForLearner(leratoChild, '2');

  const conversations = [
    {
      id: 'conv-thando',
      type: 'private',
      title: "Thando's Parent",
      subtitle: `Nomsa Mokoena · ${child.group} · Grade 2B`,
      grade: '2',
      classroom: 'Grade 2B',
      learnerId: child.id,
      parentId: thandoParent.id,
      parentName: thandoParent.name,
      teacherId: 'teacher-2',
      teacherName: 'Sir Iak',
      participantIds: ['teacher-2', thandoParent.id],
      lastMessage: 'Thank you, teacher!',
      lastMessageAt: '2026-11-02T10:45:00.000Z',
      unreadCount: { 'teacher-2': 0, [thandoParent.id]: 1 },
      createdAt: '2026-11-01T08:00:00.000Z'
    },
    {
      id: 'conv-grp-grade2',
      type: 'group',
      groupId: 'grp-grade2',
      title: 'Grade 2 Parents',
      subtitle: '3 members · Grade 2B',
      grade: '2',
      classroom: 'Grade 2B',
      teacherId: 'teacher-2',
      teacherName: 'Sir Iak',
      participantIds: ['teacher-2', thandoParent.id],
      lastMessage: 'Reminder: Homework is due tomorrow.',
      lastMessageAt: '2026-11-01T15:30:00.000Z',
      unreadCount: { 'teacher-2': 0, [thandoParent.id]: 0 },
      createdAt: '2026-10-29T09:00:00.000Z'
    },
    {
      id: 'conv-lerato',
      type: 'private',
      title: "Lerato's Parent",
      subtitle: `Kagiso Dlamini · ${leratoChild.group} · Grade 2B`,
      grade: '2',
      classroom: 'Grade 2B',
      learnerId: leratoChild.id,
      parentId: leratoParent.id,
      parentName: leratoParent.name,
      teacherId: 'teacher-2',
      teacherName: 'Sir Iak',
      participantIds: ['teacher-2', leratoParent.id],
      lastMessage: "Good morning, Ma'am.",
      lastMessageAt: '2026-10-31T07:20:00.000Z',
      unreadCount: { 'teacher-2': 1, [leratoParent.id]: 0 },
      createdAt: '2026-10-30T08:00:00.000Z'
    }
  ];

  const groups = [
    {
      id: 'grp-grade2',
      name: 'Grade 2 Parents',
      description: 'Communication between Sir Iak and Grade 2B parents.',
      creatorId: 'teacher-2',
      teacherAdminId: 'teacher-2',
      classroom: 'Grade 2B',
      grade: '2',
      onlyAdminCanSend: false,
      createdAt: '2026-10-29T09:00:00.000Z',
      members: [
        { id: 'teacher-2', name: 'Sir Iak (Teacher)', role: 'admin', status: 'accepted', joinedAt: '2026-10-29T09:00:00.000Z' },
        { id: thandoParent.id, name: `${thandoParent.name} (Thando's Mother)`, learnerName: 'Thando Mokoena', role: 'member', status: 'accepted', joinedAt: '2026-10-29T11:00:00.000Z' },
        { id: leratoParent.id, name: `${leratoParent.name} (Lerato's Father)`, learnerName: 'Lerato Dlamini', role: 'member', status: 'pending', joinedAt: null }
      ]
    }
  ];

  const groupInvitations = [
    {
      id: 'inv-lerato',
      groupId: 'grp-grade2',
      groupName: 'Grade 2 Parents',
      groupDescription: 'Communication between Sir Iak and Grade 2B parents.',
      classroom: 'Grade 2B',
      grade: '2',
      parentId: leratoParent.id,
      parentName: leratoParent.name,
      learnerName: 'Lerato Dlamini',
      teacherId: 'teacher-2',
      teacherName: 'Sir Iak',
      status: 'pending',
      createdAt: '2026-10-29T09:00:00.000Z',
      respondedAt: null
    }
  ];

  return {
    version: 1,
    classes,
    conversations,
    groups,
    groupInvitations,
    messages: [
      {
        id: 'welcome',
        conversationId: 'conv-thando',
        grade: '2',
        recipientIds: [child.id],
        text: 'How can I help Thando with the “th” sound at home?',
        sender: 'parent',
        senderRole: 'parent',
        senderId: thandoParent.id,
        senderName: thandoParent.name,
        status: 'sent',
        channels: ['App'],
        createdAt: '2026-11-01T06:40:00Z'
      },
      {
        id: 'msg-1',
        conversationId: 'conv-thando',
        grade: '2',
        recipientIds: [child.id],
        sender: 'teacher',
        senderRole: 'teacher',
        senderId: 'teacher-2',
        senderName: 'Sir Iak',
        text: 'Sawubona Nomsa! Thando read with wonderful fluency today. Keep practising the "th" sound at home.',
        channels: ['App'],
        status: 'sent',
        createdAt: '2026-11-02T10:30:00.000Z'
      },
      {
        id: 'msg-2',
        conversationId: 'conv-thando',
        grade: '2',
        recipientIds: [child.id],
        sender: 'parent',
        senderRole: 'parent',
        senderId: thandoParent.id,
        senderName: 'Nomsa Mokoena',
        text: 'Thank you, teacher!',
        channels: ['App'],
        status: 'sent',
        createdAt: '2026-11-02T10:45:00.000Z'
      },
      {
        id: 'msg-3',
        conversationId: 'conv-grp-grade2',
        grade: '2',
        recipientIds: [child.id],
        sender: 'teacher',
        senderRole: 'teacher',
        senderId: 'teacher-2',
        senderName: 'Sir Iak',
        text: 'Reminder: Homework is due tomorrow.',
        channels: ['App'],
        status: 'sent',
        createdAt: '2026-11-01T15:30:00.000Z'
      },
      {
        id: 'msg-4',
        conversationId: 'conv-lerato',
        grade: '2',
        recipientIds: [leratoChild.id],
        sender: 'parent',
        senderRole: 'parent',
        senderId: leratoParent.id,
        senderName: 'Kagiso Dlamini',
        text: "Good morning, Ma'am.",
        channels: ['App'],
        status: 'sent',
        createdAt: '2026-10-31T07:20:00.000Z'
      }
    ],
    observations: [{id:'observation-1',grade:'2',text:'Clear modelling during shared reading. Follow up with individual sound practice for learners needing support.',date:'2026-10-28'}],
    directives: [{id:'d1',grade:'3',text:'Adjust reading groups by Friday',due:'2026-11-06',status:'Open'},{id:'d2',grade:'2',text:'Provide concrete counters for subtraction',due:'2026-11-04',status:'In progress'},{id:'d3',grade:'3',text:'Log writing lessons against the ATP',due:'2026-11-02',status:'Open'}]
  };
}
export function loadData(storage=localStorage) {try {const data=JSON.parse(storage.getItem(STORAGE_KEY));if(data?.version===1&&Array.isArray(data.classes)&&data.classes.length===4)return data;}catch{} return seedData();}
export function recipients(classroom,kind,target) {return classroom.learners.filter(l=>kind==='Whole class'||(kind==='A group'?l.group===target:l.id===target)).map(l=>l.id);}
export function mean(classroom) {return Math.round(classroom.learners.reduce((s,l)=>s+l.history.at(-1),0)/classroom.learners.length);}
export function tips(learner) {return [`Practise “${learner.sounds[0]}” sounds with familiar words.`, 'Read one short page together for 10 minutes a night.', 'Point at each word while reading.'];}
export function approveMessage(message) {if(!message.text.trim()||!message.recipientIds.length||!message.channels.length)throw Error('Choose recipients, a channel and write a message.');return {...message,status:'sent',approvedAt:new Date().toISOString(),delivery:'Demo delivery'};}
