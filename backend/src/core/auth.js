import crypto from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(crypto.scrypt);
export async function hashPassword(password) {
  const salt=crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;
}
export async function verifyPassword(password,hash='') {
  const [salt,value]=hash.split(':');if(!salt||!value)return false;
  const actual=await scrypt(password,salt,64), expected=Buffer.from(value,'hex');
  return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
}
export const tokenHash=token=>crypto.createHash('sha256').update(token).digest('hex');
export function cookieToken(req) {
  return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('pula_session='))?.slice(13)||'';
}
export function publicAccount(a) {return {id:a.id,name:a.name,role:a.role,schoolId:a.schoolId,teacherCode:a.teacherCode||null};}
