import {useEffect,useRef,useState} from 'react';
import {VoiceCapture} from './voiceCapture.js';
export default function useVoiceCapture(onTranscript) {
  const [status,setStatus]=useState('idle'),[seconds,setSeconds]=useState(0),[notice,setNotice]=useState(''),[audioUrl,setAudioUrl]=useState('');
  const capture=useRef(null),url=useRef(''),callback=useRef(onTranscript);callback.current=onTranscript;
  if(!capture.current)capture.current=new VoiceCapture({onTranscript:(final,interim)=>callback.current(final,interim),onState:setStatus,onError:setNotice});
  useEffect(()=>{if(status!=='recording')return;const timer=setInterval(()=>setSeconds(capture.current.seconds+(Date.now()-capture.current.startedAt)/1000),200);return()=>clearInterval(timer);},[status]);
  useEffect(()=>()=>{capture.current.dispose();if(url.current)URL.revokeObjectURL(url.current);},[]);
  const discardAudio=()=>{if(url.current)URL.revokeObjectURL(url.current);url.current='';setAudioUrl('');};
  const stop=async()=>{const result=await capture.current.stop();setSeconds(result.seconds);if(result.blob){discardAudio();url.current=URL.createObjectURL(result.blob);setAudioUrl(url.current);}return result;};
  const start=async()=>{setNotice('');discardAudio();try{await capture.current.start();}catch(e){setStatus('idle');setNotice(e.message);}};
  const reset=async()=>{await stop();discardAudio();capture.current.clear();setSeconds(0);setNotice('');};
  return {status,seconds,notice,audioUrl,start,stop,reset,discardAudio};
}
