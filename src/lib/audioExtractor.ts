/**
 * Extracts audio from a video file and returns it as a WebM audio blob
 * Uses Web Audio API to decode and re-encode audio from video files
 */
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  console.log(`Starting audio extraction from video: ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(2)}MB)`);
  
  // Try Web Audio API decode first (fast, but fails on some codecs)
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    const audioContext = new AudioContext();
    
    try {
      console.log('Decoding audio from video file...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log(`Audio decoded: ${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
      
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      
      console.log('Rendering audio...');
      const renderedBuffer = await offlineContext.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      console.log(`Extracted audio: ${(wavBlob.size / 1024 / 1024).toFixed(2)}MB WAV`);
      await audioContext.close();
      return wavBlob;
    } catch (decodeError) {
      await audioContext.close();
      throw decodeError;
    }
  } catch (error) {
    console.warn('Web Audio decode failed, trying video element method:', error);
  }

  // Fallback: Use a video element + MediaRecorder (captures audio stream)
  try {
    console.log('Trying MediaRecorder-based audio extraction...');
    return await extractAudioViaMediaRecorder(videoFile);
  } catch (error2) {
    console.warn('MediaRecorder extraction failed:', error2);
  }
  
  // Final fallback: Send the raw video file directly (Whisper can handle video files)
  console.log('All extraction methods failed. Sending raw video file for transcription.');
  return new Blob([await videoFile.arrayBuffer()], { type: videoFile.type });
}

/**
 * Fallback: Extract audio by playing video in real-time
 * This is slower but works with more video formats
 */
/**
 * Extract audio using a video element + MediaRecorder
 * More reliable across codecs but requires brief playback
 */
async function extractAudioViaMediaRecorder(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = false;
    video.volume = 0.01;
    
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;
    
    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    
    // Timeout: max 120s for extraction
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Audio extraction timed out'));
    }, 120000);

    video.onloadedmetadata = async () => {
      try {
        console.log(`Video loaded: ${video.duration.toFixed(1)}s duration`);
        
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination);
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm';
        
        const mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          cleanup();
          audioContext.close();
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          console.log(`Extracted audio (MediaRecorder): ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
          resolve(audioBlob);
        };
        
        mediaRecorder.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          audioContext.close();
          reject(new Error('MediaRecorder audio extraction failed'));
        };
        
        mediaRecorder.start(1000);
        video.currentTime = 0;
        video.playbackRate = Math.min(4, video.duration > 60 ? 4 : 2);
        await video.play();
        
        video.onended = () => {
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        };
        
        const checkEnd = setInterval(() => {
          if (video.currentTime >= video.duration - 0.1) {
            clearInterval(checkEnd);
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
          }
        }, 500);
        
      } catch (err) {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      }
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Failed to load video'));
    };
  });
}

/**
 * Convert AudioBuffer to WAV Blob
 * This is more reliable than using MediaRecorder for compatibility
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  // Interleave channels
  const length = buffer.length * numChannels;
  const result = new Float32Array(length);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      result[i * numChannels + channel] = channelData[i];
    }
  }
  
  // Create WAV file
  const dataSize = length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    // Clamp and convert to 16-bit
    const sample = Math.max(-1, Math.min(1, result[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Fast audio extraction - uses the main extraction method
 */
export async function extractAudioFast(videoFile: File): Promise<Blob> {
  return extractAudioFromVideo(videoFile);
}
