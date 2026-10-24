import { useRef, useEffect } from 'react';

interface Props {
  stream: MediaStream | null;
  onQualityFeedback?: (feedback: 'ok' | 'too_quiet' | 'too_noisy' | 'clipping') => void;
}

export default function LevelMeter({ stream, onQualityFeedback }: Props) {
  const levelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const callbackRef = useRef(onQualityFeedback);
  const smoothedLevel = useRef(0);

  useEffect(() => { callbackRef.current = onQualityFeedback; }, [onQualityFeedback]);

  useEffect(() => {
    if (!stream) {
      if (levelRef.current) levelRef.current.style.width = '0%';
      smoothedLevel.current = 0;
      callbackRef.current?.('ok');
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let lastQuality = '';
    let candidateQuality = '';
    let candidateSince = performance.now();
    let lastQualityCheck = 0;
    let lastPaint = 0;

    function tick(now: number) {
      analyser.getByteTimeDomainData(data);
      // Compute RMS and peak
      let sum = 0, peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      const rms = Math.sqrt(sum / data.length);
      // Gate background hiss and use a slow envelope: quick enough to show
      // speech, but not so fast that every syllable makes the bar jump.
      const pct = rms < 0.012 ? 0 : Math.min(82, (rms - 0.012) * 180);
      const alpha = pct > smoothedLevel.current ? 0.07 : 0.025;
      smoothedLevel.current += (pct - smoothedLevel.current) * alpha;
      if (levelRef.current && now - lastPaint >= 50) {
        lastPaint = now;
        levelRef.current.style.width = `${Math.round(smoothedLevel.current)}%`;
      }

      // Debounce feedback to avoid flickering labels as speech volume changes.
      if (now - lastQualityCheck > 450) {
        lastQualityCheck = now;
        let feedback: 'ok' | 'too_quiet' | 'too_noisy' | 'clipping' = 'ok';
        if (peak > 0.98) feedback = 'clipping';
        else if (rms > 0.48) feedback = 'too_noisy';
        else if (rms < 0.008 && peak < 0.025) feedback = 'too_quiet';

        if (feedback !== candidateQuality) {
          candidateQuality = feedback;
          candidateSince = now;
        } else if (feedback !== lastQuality && now - candidateSince >= 900) {
          lastQuality = feedback;
          callbackRef.current?.(feedback);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      void ctx.close();
    };
  }, [stream]);

  return (
    <div className="level-meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100}>
      <div className="level-meter-fill" ref={levelRef} style={{width:'0%'}} />
    </div>
  );
}
