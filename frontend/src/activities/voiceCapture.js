// Raw voice stays in memory. No upload, logging, localStorage or IndexedDB writes.
export class VoiceCapture {
  constructor({mediaDevices=globalThis.navigator?.mediaDevices,Recorder=globalThis.MediaRecorder,Speech=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,onTranscript=()=>{},onState=()=>{},onError=()=>{},onAmplitude=()=>{}}={}) {
    Object.assign(this,{mediaDevices,Recorder,Speech,onTranscript,onState,onError,onAmplitude});
    this.active=false;this.generation=0;this.transcript='';this.seconds=0;this.hasRecorded=false;
    this.audioContext=null;this.analyser=null;this.sourceNode=null;this.animationFrame=null;this.lastAmplitude=0;
  }
  setupAnalyser(stream) {
    const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtor || !stream) return;
    try {
      this.audioContext = new AudioCtor();
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.sourceNode.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.active || !this.analyser) return;
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / data.length);
        const normalized = Math.min(1, Math.max(0, rms * 6));
        const smoothed = this.lastAmplitude * 0.7 + normalized * 0.3;
        this.lastAmplitude = smoothed;
        this.onAmplitude(smoothed);
        this.animationFrame = requestAnimationFrame(tick);
      };
      this.animationFrame = requestAnimationFrame(tick);
    } catch {
      this.analyser = null;
      this.sourceNode = null;
      this.audioContext = null;
      this.lastAmplitude = 0;
      this.onAmplitude(0);
    }
  }
  async start() {
    if(this.active||this.requesting||this.stopPromise)return;
    this.requesting=true;
    const generation=++this.generation;
    this.onState('requesting');
    if(!this.mediaDevices?.getUserMedia){this.requesting=false;this.onState('idle');throw Error('Microphone access needs HTTPS or localhost and a browser that supports audio capture.');}
    let stream;
    try {stream=await this.mediaDevices.getUserMedia({audio:true});}
    catch(e){this.requesting=false;this.onState('idle');throw Error(e.name==='NotAllowedError'?'Microphone permission was blocked. Allow the microphone in your browser’s site settings, then try again.':e.name==='NotFoundError'?'No microphone was found. Connect one and try again.':'The microphone could not start. Check that another app is not using it.');}
    this.requesting=false;
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
    this.stream=stream;this.active=true;this.startedAt=Date.now();this.chunks=[];this.lastAmplitude=0;this.onAmplitude(0);
    this.setupAnalyser(stream);
    if(this.Recorder) {
      try {
        this.recorder=new this.Recorder(stream);
        this.recorder.ondataavailable=e=>{if(e.data?.size)this.chunks.push(e.data);};
        this.recorder.start(250);this.hasRecorded=true;
      }catch {this.recorder=null;}
    }
    if(!this.recorder&&!this.Speech){this.dispose();throw Error('This browser cannot record audio. Try Chrome or Edge, or continue with your teacher.');}
    if(this.Speech) {
      const speech=new this.Speech();this.speech=speech;
      const prefix=this.transcript;
      speech.lang='en-ZA';speech.continuous=true;speech.interimResults=true;
      speech.onresult=e=>{
        const final=[],interim=[];
        for(let i=0;i<e.results.length;i++)(e.results[i].isFinal?final:interim).push(e.results[i][0].transcript);
        this.transcript=[prefix,...final].filter(Boolean).join(' ').trim().slice(0,1500);
        this.onTranscript(this.transcript,interim.join(' '));
      };
      speech.onerror=e=>{if(e.error==='aborted')return;this.onError(e.error==='not-allowed'?'Speech-to-text permission was blocked. Your microphone recording can still be played back.':e.error==='no-speech'?'No words were picked up yet. Speak a little closer to the microphone.':'Speech-to-text is unavailable right now. Your microphone recording can still be played back.');};
      speech.onend=()=>{this.speechEnded=true;this.resolveSpeech?.();if(this.active)this.onError('Speech-to-text paused. Stop and tap the microphone again to continue transcription. Audio is still recording.');};
      this.speechEnded=false;
      try {speech.start();this.hasRecorded=true;}catch {this.speechEnded=true;this.onError('Speech-to-text could not start. You can still record and listen back.');}
    } else this.onError('This browser can record audio but has no built-in speech-to-text. Listen back with your teacher.');
    this.onState('recording');
  }
  stop() {
    if(this.stopPromise)return this.stopPromise;
    this.stopPromise=this.finishCapture().finally(()=>{this.stopPromise=null;});
    return this.stopPromise;
  }
  async finishCapture() {
    if(!this.active){++this.generation;this.requesting=false;this.onState('idle');return {transcript:this.transcript,seconds:this.seconds,recordingCaptured:this.hasRecorded,blob:null};}
    this.active=false;this.onState('stopping');
    this.seconds+=(Date.now()-this.startedAt)/1000;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.onAmplitude(0);
    this.lastAmplitude = 0;
    const recorder=this.recorder,speech=this.speech;
    let timeout,audioTimeout;
    const speechDone=!speech||this.speechEnded?Promise.resolve():new Promise(resolve=>{this.resolveSpeech=resolve;timeout=setTimeout(resolve,1200);try{speech.stop();}catch{resolve();}});
    const audioDone=!recorder||recorder.state==='inactive'?Promise.resolve():new Promise(resolve=>{audioTimeout=setTimeout(resolve,1500);this.resolveAudio=resolve;recorder.onstop=resolve;try{recorder.stop();}catch{resolve();}});
    try {await Promise.all([speechDone,audioDone]);}
    finally {clearTimeout(timeout);clearTimeout(audioTimeout);this.resolveSpeech=null;this.resolveAudio=null;if(speech){speech.onresult=null;speech.onend=null;speech.onerror=null;}try{speech?.abort();}catch{}this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.speech=null;this.recorder=null;this.onState('idle');}
    const blob=this.chunks.length?new Blob(this.chunks,{type:recorder?.mimeType||this.chunks[0].type||'audio/webm'}):null;
    this.chunks=[];
    if (this.audioContext) {
      try { await this.audioContext.close(); } catch {}
    }
    this.audioContext=null;this.analyser=null;this.sourceNode=null;
    return {transcript:this.transcript,seconds:this.seconds,recordingCaptured:this.hasRecorded,blob};
  }
  clear() {this.transcript='';this.seconds=0;this.hasRecorded=false;this.onTranscript('','');}
  dispose() {
    ++this.generation;this.active=false;this.requesting=false;
    if(this.speech){this.speech.onresult=null;this.speech.onend=null;this.speech.onerror=null;}
    try{this.speech?.abort();}catch{}
    if(this.recorder){this.recorder.ondataavailable=null;this.recorder.onstop=null;try{if(this.recorder.state!=='inactive')this.recorder.stop();}catch{} }
    if(this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.chunks=[];this.speech=null;this.recorder=null;this.resolveSpeech?.();this.resolveAudio?.();
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
    }
    this.audioContext=null;this.analyser=null;this.sourceNode=null;this.onAmplitude(0);this.lastAmplitude=0;
  }
}
