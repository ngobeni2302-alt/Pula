// Server-owned targets. Clients submit evidence, never authoritative goals or scores.
export const ACTIVITIES = {
  'reading-time': { name: 'Sound and Rhyme Session', subject: 'English', icon: '', rounds: [
    { target: 'The sun is up. The cat sat on a mat.' },
    { target: 'We see a red bus. The bus stops at the shop.' },
    { target: 'The children plant a seed. They give it water every day.' }
  ] },
  'number-hunt': { name: 'Number Hunt', subject: 'Mathematics', icon: '🔎', rounds: [3,7,5].map(target => ({ target: String(target), options: Array.from({length:10},(_,i)=>String(i+1)), answer: String(target) })) },
  'count-and-pick': { name: 'Count and Pick', subject: 'Mathematics', icon: '🐘', rounds: [
    { target:'Count the elephants', picture:'🐘', count:4, options:['3','4','5'], answer:'4' },
    { target:'Count the minibus taxis', picture:'🚐', count:6, options:['5','7','6'], answer:'6' },
    { target:'Count the mielies', picture:'🌽', count:5, options:['5','4','6'], answer:'5' }
  ] },
  'rhyme-time': { name: 'Rhyme Time', subject:'English', icon:'🐱', rounds:[
    { target:'cat', picture:'🐱', options:['hat','sun','dog'], answer:'hat' },
    { target:'sun', picture:'☀️', options:['cat','run','bus'], answer:'run' },
    { target:'dog', picture:'🐶', options:['log','hat','sun'], answer:'log' }
  ] },
  'sound-it-out': { name:'Sound It Out', subject:'English', icon:'🔤', rounds:[
    {target:'van', picture:'🚐'}, {target:'sun', picture:'☀️'}, {target:'cat', picture:'🐱'}
  ] }
};
export function publicActivity(id, grade) {
  const a = ACTIVITIES[id];
  if (!a) return null;
  const rounds = id === 'reading-time' ? [a.rounds[grade === 'R' || grade === '1' ? 0 : Number(grade)-1]] : a.rounds;
  return { id, name:a.name, subject:a.subject, icon:a.icon, rounds:rounds.map(({answer,...r})=>r) };
}
export function serverRounds(id, grade) {
  return id === 'reading-time' ? [ACTIVITIES[id].rounds[grade === 'R' || grade === '1' ? 0 : Number(grade)-1]] : ACTIVITIES[id].rounds;
}
