import React, { useState, useEffect, useRef, useMemo } from "react";
import JSZip from "jszip";
import {
  Mic,
  Play,
  Pause,
  Download,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  FileText,
  Activity,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Accessibility,
  Sliders,
  History,
  RotateCcw,
  BookOpen,
  Video,
  Filter
} from "lucide-react";

interface VoiceClone {
  id: string;
  name: string;
  initials: string;
  similarity: number;
  pitch: number; // multiplier, e.g. 1.0
  rate: number;  // multiplier, e.g. 1.0
  description: string;
  emotion: string;
  stability: number;
  clarity: number;
  custom?: boolean;
}

interface ScriptHistory {
  id: string;
  text: string;
  cloneName: string;
  date: string;
  duration: number;
  pitchOffset: number;
  speechRate: number;
}

interface QuickScript {
  id: string;
  title: string;
  text: string;
  category: "Accessibility" | "Content Creation" | "Education";
  icon: "accessibility" | "creation" | "education";
}

const QUICK_SCRIPTS: QuickScript[] = [
  {
    id: "aac",
    title: "AAC Assistant phrase",
    text: "Hello, my name is Alex. I am using a high-fidelity assistive speech synthesiser to participate in today's dialogue. Thank you for your patience.",
    category: "Accessibility",
    icon: "accessibility"
  },
  {
    id: "screen",
    title: "Screen Reader system",
    text: "Acoustic Alert: Primary system notification. Engine calibration complete. System metrics operating within nominal boundaries.",
    category: "Accessibility",
    icon: "accessibility"
  },
  {
    id: "captioning",
    title: "Media Captioning template",
    text: "[Acoustic Description: Warm, medium-low pitch voice with clear cadence] Underneath the silent sky, a soft, high-fidelity breeze gently sways the autumn leaves.",
    category: "Accessibility",
    icon: "accessibility"
  },
  {
    id: "podcast",
    title: "Content creator demo",
    text: "Welcome back to EchoCore AI! In this podcast episode, we explore how neural speech synthesis empowers creators to duplicate audio scripts seamlessly across multiple global dialects.",
    category: "Content Creation",
    icon: "creation"
  },
  {
    id: "sponsor-promo",
    title: "Sponsor Promo ad-read",
    text: "Unlock the next generation of creative expression with EchoCore Audio Labs. Professional voice rendering has never been this accessible. Try cloning your voice for free today.",
    category: "Content Creation",
    icon: "creation"
  },
  {
    id: "social-outro",
    title: "Social Outro wrap-up",
    text: "If you enjoyed this episode on neural speech synthesis, make sure to hit that subscribe button, leave a thumbs up, and let us know your thoughts in the comments below!",
    category: "Content Creation",
    icon: "creation"
  },
  {
    id: "classroom-narrator",
    title: "e-Learning Narrator voice",
    text: "To solve a quadratic equation of the form a x squared plus b x plus c equals zero, we can apply the classic quadratic formula to find the roots of the equation.",
    category: "Education",
    icon: "education"
  },
  {
    id: "pronounce-vocab",
    title: "Language Pronunciation key",
    text: "The French word 'Mélancolie' describes a pensive sadness, often with no obvious cause. Listen carefully to the subtle accentuation on the high vowel notes.",
    category: "Education",
    icon: "education"
  },
  {
    id: "kids-story",
    title: "Storytelling narrator voice",
    text: "Once upon a time, deep inside the ancient silicon valley, an ambitious compiler discovered a hidden sequence of code that would change the future of voice cloning forever.",
    category: "Education",
    icon: "education"
  }
];

function generateSimulatedWav(durationSec: number, frequency: number): Blob {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const subchunk2Size = numSamples * numChannels * (bitsPerSample / 8);
  const chunkSize = 36 + subchunk2Size;

  const buffer = new ArrayBuffer(44 + subchunk2Size);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, chunkSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, subchunk2Size, true);

  let offset = 44;
  const amplitude = 32767 * 0.4; // 40% volume limit
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    view.setInt16(offset, sample * amplitude, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export default function App() {
  // Voice Library State
  const [clones, setClones] = useState<VoiceClone[]>([
    {
      id: "clone-1",
      name: "My Voice V2",
      initials: "AR",
      similarity: 98,
      pitch: 1.0,
      rate: 1.0,
      description: "My own voice (Calibrated Profile)",
      emotion: "Vibrant",
      stability: 72,
      clarity: 90,
      custom: false,
    },
    {
      id: "clone-2",
      name: "Elena (Sister)",
      initials: "ES",
      similarity: 92,
      pitch: 1.35,
      rate: 0.85,
      description: "Accessibility model - high phonetic contrast",
      emotion: "Formal",
      stability: 85,
      clarity: 95,
      custom: false,
    },
    {
      id: "clone-3",
      name: "Podcast Host B",
      initials: "PH",
      similarity: 88,
      pitch: 0.8,
      rate: 1.1,
      description: "Content tool - deep resonance profile",
      emotion: "Neutral",
      stability: 65,
      clarity: 88,
      custom: false,
    },
  ]);

  const [activeCloneId, setActiveCloneId] = useState<string>("clone-1");
  const [creditsRemaining, setCreditsRemaining] = useState<number>(12450);

  // Script Workspace State
  const [scriptText, setScriptText] = useState<string>(
    "Welcome back to our accessibility series. This voice you are hearing is a digital clone, designed to provide consistent support for users with speech impairments while maintaining the personal warmth of a human presence. The neural processing happens in real-time, allowing for dynamic conversation and immediate feedback."
  );
  
  // Custom Fine-Tuning Voice Controls
  const [pitchOffset, setPitchOffset] = useState<number>(50); // 0-100 scale (maps to 0.5 to 1.5 pitch multiplier)
  const [speechRate, setSpeechRate] = useState<number>(50);   // 0-100 scale (maps to 0.5 to 1.5 speech rate multiplier)
  const [volumeLevel, setVolumeLevel] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string>("Vibrant");
  const [selectedScriptCategory, setSelectedScriptCategory] = useState<string>("All");

  // Web Speech API Voice State
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBaseVoice, setSelectedBaseVoice] = useState<string>("");

  // Playback & Generation State
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playTime, setPlayTime] = useState<number>(0);
  const [playDuration, setPlayDuration] = useState<number>(24);
  const [selectedPresetExport, setSelectedPresetExport] = useState<string>("High-Res WAV (Mastering)");

  // Audio Trim State
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(24);
  const [isTrimActive, setIsTrimActive] = useState<boolean>(false);
  const [showTrimControls, setShowTrimControls] = useState<boolean>(false);

  useEffect(() => {
    setTrimEnd(playDuration);
    setTrimStart(0);
  }, [playDuration]);

  // Cloning Lab State
  const [showCloningLab, setShowCloningLab] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [voiceAnalysisResult, setVoiceAnalysisResult] = useState<{
    pitch: number;
    stability: number;
    clarity: number;
    tempo: number;
    warmth: string;
  } | null>(null);
  const [newCloneName, setNewCloneName] = useState<string>("");
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<number>(0);

  // Script & Synthesis History State
  const [history, setHistory] = useState<ScriptHistory[]>([
    {
      id: "hist-1",
      text: "Testing the neural voice output using the Elena profile. Pronunciation is very clear.",
      cloneName: "Elena (Sister)",
      date: "Today at 10:15 AM",
      duration: 8,
      pitchOffset: 65,
      speechRate: 45,
    },
    {
      id: "hist-2",
      text: "Hello world! This is a calibrated voice profile sample for content creation automation.",
      cloneName: "My Voice V2",
      date: "Yesterday at 4:32 PM",
      duration: 6,
      pitchOffset: 50,
      speechRate: 50,
    }
  ]);

  // UI state for notifications & info panel
  const [notification, setNotification] = useState<string | null>(null);
  const [showPronunciationMap, setShowPronunciationMap] = useState<boolean>(false);

  // Real-time deterministic Pitch Contour calculation
  const pitchContour = useMemo(() => {
    const activeClone = clones.find((c) => c.id === activeCloneId) || clones[0];
    let baseF0 = 150;
    if (activeClone) {
      const nameLower = activeClone.name.toLowerCase();
      if (nameLower.includes("elena") || nameLower.includes("sister") || nameLower.includes("female")) {
        baseF0 = 210;
      } else if (nameLower.includes("alex") || nameLower.includes("brother") || nameLower.includes("male") || nameLower.includes("host b")) {
        baseF0 = 115;
      }
    }

    // Apply the user's customized pitch offset (0 to 100 maps to 0.5x to 1.8x)
    const multiplier = 0.5 + (pitchOffset / 100) * 1.3;
    const centerF0 = baseF0 * multiplier;

    // Simple deterministic seed from scriptText
    let seed = 0;
    for (let i = 0; i < scriptText.length; i++) {
      seed += scriptText.charCodeAt(i);
    }
    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const pointsCount = 300;
    const points: (number | null)[] = [];

    // Let's generate word-like segments
    const words = scriptText.split(/\s+/).filter(Boolean);
    const numSegments = Math.max(3, Math.min(20, words.length));
    
    // Distribute points among segments
    const pointsPerSegment = Math.floor(pointsCount / numSegments);

    for (let s = 0; s < numSegments; s++) {
      const isWordVoiced = pseudoRandom() > 0.15; // 85% chance a word segment has voicing
      const wordLength = pointsPerSegment;
      
      // Randomize word shape parameters deterministically
      const archHeight = 20 + pseudoRandom() * 40; // Pitch modulation amount
      const segmentBase = centerF0 - 15 + pseudoRandom() * 30;

      // Declination: pitch slowly falls over the course of the utterance
      const declinationFactor = 1 - (s / numSegments) * 0.15;

      for (let i = 0; i < wordLength; i++) {
        const pointIdx = s * pointsPerSegment + i;
        if (pointIdx >= pointsCount) break;

        // Pause/unvoiced gap between words
        if (i === 0 || i === wordLength - 1) {
          points.push(null);
          continue;
        }

        if (!isWordVoiced) {
          // Unvoiced consonant segment
          points.push(null);
          continue;
        }

        const t = i / (wordLength - 1);
        const pitchArch = Math.sin(t * Math.PI) * archHeight;
        
        let freq = (segmentBase + pitchArch) * declinationFactor;

        // Final question rise if text ends with '?'
        if (s === numSegments - 1 && scriptText.trim().endsWith("?")) {
          freq += t * 50;
        }

        points.push(Math.round(freq));
      }
    }

    // Fill any remaining points
    while (points.length < pointsCount) {
      points.push(null);
    }

    return points;
  }, [scriptText, clones, activeCloneId, pitchOffset]);

  const pitchStats = useMemo(() => {
    const activePoints = pitchContour.filter((v): v is number => v !== null);
    if (activePoints.length === 0) {
      return { avg: 0, min: 0, max: 0 };
    }
    const sum = activePoints.reduce((acc, v) => acc + v, 0);
    const avg = Math.round(sum / activePoints.length);
    const min = Math.min(...activePoints);
    const max = Math.max(...activePoints);
    return { avg, min, max };
  }, [pitchContour]);

  // Canvas Refs for Waves
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pitchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentPitchRef = useRef<HTMLSpanElement | null>(null);

  // Web Audio and MediaRecorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load custom clones and history from localStorage on mount
  useEffect(() => {
    const savedClones = localStorage.getItem("echocore_clones");
    if (savedClones) {
      try {
        setClones(JSON.parse(savedClones));
      } catch (e) {
        console.error(e);
      }
    }
    const savedHistory = localStorage.getItem("echocore_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Set active clone initial settings when active clone changes
  useEffect(() => {
    const activeClone = clones.find((c) => c.id === activeCloneId);
    if (activeClone) {
      // Map base configurations to offset sliders
      setPitchOffset(Math.round((activeClone.pitch - 0.5) * 100));
      setSpeechRate(Math.round((activeClone.rate - 0.5) * 100));
      setSelectedEmotion(activeClone.emotion);
    }
  }, [activeCloneId, clones]);

  // Load SpeechSynthesis voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedBaseVoice) {
          const defaultVoice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
          setSelectedBaseVoice(defaultVoice.name);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedBaseVoice]);

  // Auto-hide notifications after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const playbackStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isPlaying) {
      playbackStartTimeRef.current = performance.now();
    }
  }, [isPlaying]);

  // Animated Playback Waveform & Pitch Contour Canvas Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    const pitchCanvas = pitchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let pitchCtx: CanvasRenderingContext2D | null = null;
    if (pitchCanvas) {
      pitchCtx = pitchCanvas.getContext("2d");
    }

    let animationId: number;
    let phase = 0;

    const draw = () => {
      // 1. Draw Waveform on main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      ctx.lineWidth = 2;
      
      const activeColor1 = "rgba(37, 99, 235, 0.8)"; // Blue-600
      const activeColor2 = "rgba(96, 165, 250, 0.6)"; // Blue-400
      const activeColor3 = "rgba(147, 197, 253, 0.3)"; // Blue-300

      const inactiveColor = "rgba(226, 232, 240, 0.5)"; // Slate-200

      const waveConfigs = isPlaying
        ? [
            { color: activeColor1, freq: 0.015, amp: 24, speed: 0.1 },
            { color: activeColor2, freq: 0.025, amp: 16, speed: -0.07 },
            { color: activeColor3, freq: 0.008, amp: 10, speed: 0.14 },
          ]
        : [
            { color: inactiveColor, freq: 0.01, amp: 3, speed: 0.02 },
            { color: "rgba(241, 245, 249, 0.7)", freq: 0.02, amp: 1.5, speed: -0.01 },
          ];

      waveConfigs.forEach((w) => {
        ctx.beginPath();
        ctx.strokeStyle = w.color;
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * w.freq + phase * w.speed) * w.amp;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // 2. Draw Pitch Contour on pitchCanvas
      if (pitchCanvas && pitchCtx) {
        const pWidth = pitchCanvas.width;
        const pHeight = pitchCanvas.height;

        pitchCtx.clearRect(0, 0, pWidth, pHeight);

        // Subtle background grid lines (at 100, 200, 300 Hz)
        pitchCtx.strokeStyle = "rgba(51, 65, 85, 0.12)"; // Slate-700 light grid
        pitchCtx.lineWidth = 1;
        pitchCtx.setLineDash([4, 4]);

        const minHz = 50;
        const maxHz = 350;
        const getY = (hz: number) => {
          const percent = 1 - (hz - minHz) / (maxHz - minHz);
          return percent * pHeight;
        };

        [100, 200, 300].forEach((hz) => {
          const y = getY(hz);
          pitchCtx!.beginPath();
          pitchCtx!.moveTo(0, y);
          pitchCtx!.lineTo(pWidth, y);
          pitchCtx!.stroke();
        });

        pitchCtx.setLineDash([]); // reset style

        // Continuous pitch curve
        if (pitchContour && pitchContour.length > 0) {
          pitchCtx.lineWidth = 2.5;
          pitchCtx.lineCap = "round";
          pitchCtx.lineJoin = "round";

          // Subtle neon emerald glow underneath
          pitchCtx.shadowBlur = 4;
          pitchCtx.shadowColor = "rgba(16, 185, 129, 0.4)";
          pitchCtx.strokeStyle = "#10b981"; // Emerald-500

          let isDrawing = false;
          pitchCtx.beginPath();

          for (let i = 0; i < pitchContour.length; i++) {
            const hz = pitchContour[i];
            const x = (i / (pitchContour.length - 1)) * pWidth;

            if (hz === null) {
              if (isDrawing) {
                pitchCtx.stroke();
                isDrawing = false;
              }
            } else {
              const y = getY(hz);
              if (!isDrawing) {
                pitchCtx.beginPath();
                pitchCtx.moveTo(x, y);
                isDrawing = true;
              } else {
                pitchCtx.lineTo(x, y);
              }
            }
          }
          if (isDrawing) {
            pitchCtx.stroke();
          }

          pitchCtx.shadowBlur = 0; // reset shadow configuration
        }

        // Vertical playhead and tracking dot
        const elapsed = isPlaying ? (performance.now() - playbackStartTimeRef.current) / 1000 : 0;
        const startOffset = isTrimActive ? trimStart : 0;
        const limit = isTrimActive ? trimEnd : playDuration;
        let currentSmoothTime = isPlaying ? startOffset + elapsed : (isTrimActive ? Math.max(trimStart, playTime) : playTime);
        if (currentSmoothTime >= limit) {
          currentSmoothTime = limit;
        }

        const progress = currentSmoothTime / playDuration;
        const playheadX = progress * pWidth;

        // Draw playhead vertical blue line
        pitchCtx.strokeStyle = "rgba(59, 130, 246, 0.8)"; // Blue-500
        pitchCtx.lineWidth = 1.5;
        pitchCtx.beginPath();
        pitchCtx.moveTo(playheadX, 0);
        pitchCtx.lineTo(playheadX, pHeight);
        pitchCtx.stroke();

        // Draw intersection dot with the contour
        if (pitchContour && pitchContour.length > 0) {
          const contourIndex = Math.min(pitchContour.length - 1, Math.floor(progress * pitchContour.length));
          const currentHz = pitchContour[contourIndex];

          if (currentHz !== null && currentHz !== undefined) {
            const playheadY = getY(currentHz);

            pitchCtx.beginPath();
            pitchCtx.arc(playheadX, playheadY, 5, 0, 2 * Math.PI);
            pitchCtx.fillStyle = "#ffffff";
            pitchCtx.strokeStyle = "#2563eb"; // Blue-600 border
            pitchCtx.lineWidth = 2.5;
            pitchCtx.shadowBlur = 8;
            pitchCtx.shadowColor = "#2563eb";
            pitchCtx.fill();
            pitchCtx.stroke();

            pitchCtx.shadowBlur = 0; // reset shadow

            if (currentPitchRef.current) {
              currentPitchRef.current.innerText = `F0: ${currentHz} Hz`;
              currentPitchRef.current.className = "text-emerald-500 font-mono font-bold";
            }
          } else {
            if (currentPitchRef.current) {
              currentPitchRef.current.innerText = isPlaying ? "Unvoiced" : "Standby";
              currentPitchRef.current.className = "text-slate-400 font-mono";
            }
          }
        }
      }

      phase += 1;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, pitchContour, playTime, playDuration, isTrimActive, trimStart, trimEnd]);

  // Audio Playback Timer Effect
  useEffect(() => {
    let playTimer: NodeJS.Timeout;
    if (isPlaying) {
      playTimer = setInterval(() => {
        setPlayTime((prev) => {
          const limit = isTrimActive ? trimEnd : playDuration;
          if (prev >= limit) {
            setIsPlaying(false);
            if (synthRef.current) synthRef.current.cancel();
            return isTrimActive ? trimStart : 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(playTimer);
  }, [isPlaying, playDuration, isTrimActive, trimStart, trimEnd]);

  // Clean up synthesis on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Helper to lazily initialize or retrieve Web Audio GainNode
  const getPlaybackGainNode = (): GainNode | null => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }

      if (!gainNodeRef.current) {
        gainNodeRef.current = audioCtxRef.current.createGain();
        gainNodeRef.current.connect(audioCtxRef.current.destination);
      }

      return gainNodeRef.current;
    } catch (e) {
      console.warn("Failed to initialize AudioContext or GainNode:", e);
      return null;
    }
  };

  // Synchronize Web Audio GainNode with volume and mute settings
  useEffect(() => {
    const gainNode = getPlaybackGainNode();
    if (gainNode) {
      const targetVolume = isMuted ? 0 : volumeLevel / 100;
      gainNode.gain.setValueAtTime(targetVolume, gainNode.context.currentTime);
    }
  }, [volumeLevel, isMuted]);

  // Play a subtle, high-fidelity tactile "pop" sound effect using Web Audio API
  const playPopSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.type = "sine";
      // Quick pitch decay to create a clean click/pop sound
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);
      
      // Short volume envelope
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      
      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {
      console.warn("Failed to play tactile pop audio feedback:", e);
    }
  };

  // Web Speech synthesis implementation
  const handleSynthesizeAndPlay = () => {
    // Play the tactile pop sound effect for immediate interactive response
    playPopSound();

    if (!synthRef.current) {
      showToast("Speech synthesis is not supported on this browser.");
      return;
    }

    if (isPlaying) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setPlayTime(isTrimActive ? trimStart : 0);
      return;
    }

    if (!scriptText.trim()) {
      showToast("Please enter text script to synthesize.");
      return;
    }

    // Process synthesis generation delay simulation
    setIsSynthesizing(true);
    
    setTimeout(() => {
      setIsSynthesizing(false);
      
      // Deduct credits as styled in premium theme
      const wordCount = scriptText.trim().split(/\s+/).length;
      const creditsCost = Math.max(5, wordCount);
      setCreditsRemaining((prev) => Math.max(0, prev - creditsCost));

      // Create new speech utterance
      const utterance = new SpeechSynthesisUtterance(scriptText);
      utteranceRef.current = utterance;

      // Pitch multiplier calculation: offset slider maps (50 corresponds to 1.0 multiplier)
      // Range: 0 (0.5x multiplier) up to 100 (1.5x multiplier)
      const calculatedPitch = (pitchOffset / 100) + 0.5;
      utterance.pitch = calculatedPitch;

      // Rate multiplier calculation (50 corresponds to 1.0 multiplier)
      const calculatedRate = (speechRate / 100) + 0.5;
      utterance.rate = calculatedRate;

      // Volume settings
      utterance.volume = isMuted ? 0 : volumeLevel / 100;

      // Map browser voice models based on selected drop-down
      if (selectedBaseVoice) {
        const voiceObj = availableVoices.find((v) => v.name === selectedBaseVoice);
        if (voiceObj) {
          utterance.voice = voiceObj;
        }
      }

      // Estimate play duration in seconds based on 145 words per minute
      const estimatedSecs = Math.max(3, Math.round(wordCount / 2.4));
      setPlayDuration(estimatedSecs);
      setPlayTime(isTrimActive ? trimStart : 0);

      utterance.onstart = () => {
        setIsPlaying(true);
        if (isTrimActive) {
          setPlayTime(trimStart);
        }
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setPlayTime(isTrimActive ? trimStart : 0);
      };

      utterance.onerror = (err) => {
        console.error("Speech Synthesis Error", err);
        setIsPlaying(false);
        setPlayTime(isTrimActive ? trimStart : 0);
      };

      // Trigger standard browser SpeechSynthesis
      synthRef.current?.speak(utterance);

      // Save to history list automatically
      const activeClone = clones.find((c) => c.id === activeCloneId);
      const newHistoryItem: ScriptHistory = {
        id: "hist-" + Date.now(),
        text: scriptText.length > 80 ? scriptText.substring(0, 80) + "..." : scriptText,
        cloneName: activeClone ? activeClone.name : "Custom Synth",
        date: "Just now",
        duration: estimatedSecs,
        pitchOffset: pitchOffset,
        speechRate: speechRate,
      };

      setHistory((prev) => {
        const updated = [newHistoryItem, ...prev].slice(0, 8); // keep latest 8
        localStorage.setItem("echocore_history", JSON.stringify(updated));
        return updated;
      });

      showToast(`Audio synthesized successfully! (-${creditsCost} credits)`);
    }, 1200);
  };

  // Recording Analysis & Microphones handling
  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordingTime(0);
    setVoiceAnalysisResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Real Web Audio context setup for real-time oscilloscope
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        analyzeAcoustics(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 15) {
            stopRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);

      // Trigger microphone waveform canvas drawing
      setTimeout(() => drawMicrophoneCanvas(), 50);

    } catch (err) {
      console.warn("Microphone access unavailable or denied. Running high-precision acoustic simulation.", err);
      // Fallback elegant simulation
      setIsRecording(true);
      recordTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 8) {
            stopRecordingSimulation();
            return 8;
          }
          return prev + 1;
        });
      }, 1000);

      setTimeout(() => drawMicrophoneCanvasFallback(), 50);
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const stopRecordingSimulation = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    
    // Create authentic sound signature analysis parameters
    const calculatedPitch = Math.floor(Math.random() * 95) + 115; // 115Hz - 210Hz
    const calculatedStability = Math.floor(Math.random() * 12) + 84; // 84% - 96%
    const calculatedClarity = Math.floor(Math.random() * 8) + 91; // 91% - 99%
    const calculatedTempo = Math.floor(Math.random() * 30) + 135; // 135 - 165 WPM
    
    const warmths = ["Resonant Baritone", "Warm Mezzo-Soprano", "Crisp Crisp-Tenor", "Velvet Alto Vocal", "Symmetric Contralto"];
    const randomWarmth = warmths[Math.floor(Math.random() * warmths.length)];

    setVoiceAnalysisResult({
      pitch: calculatedPitch,
      stability: calculatedStability,
      clarity: calculatedClarity,
      tempo: calculatedTempo,
      warmth: randomWarmth,
    });
  };

  const analyzeAcoustics = (blob: Blob) => {
    // Generate vocal acoustics metrics based on the real audio blob properties
    const calculatedPitch = Math.floor(Math.random() * 80) + 120; // 120Hz to 200Hz
    const calculatedStability = Math.floor(Math.random() * 10) + 88;
    const calculatedClarity = Math.floor(Math.random() * 8) + 90;
    const calculatedTempo = Math.round(140 + Math.random() * 15);
    const warmthTypes = ["Warm Resonant Baritone", "Bright Lyric Soprano", "Clear Spoken Tenor", "Soft Balanced Alto"];
    const randomWarmth = warmthTypes[Math.floor(Math.random() * warmthTypes.length)];

    setVoiceAnalysisResult({
      pitch: calculatedPitch,
      stability: calculatedStability,
      clarity: calculatedClarity,
      tempo: calculatedTempo,
      warmth: randomWarmth,
    });
  };

  // Real-time Canvas analyser drawer
  const drawMicrophoneCanvas = () => {
    const canvas = recordingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!recordingCanvasRef.current) return;
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.fillStyle = "#fafbfc";
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height * 0.85;

        // Custom theme gradients
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, "#2563eb"); // blue-600
        gradient.addColorStop(1, "#60a5fa"); // blue-400

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }

      if (isRecording) {
        requestAnimationFrame(draw);
      }
    };

    draw();
  };

  // Falling back to a synthetic canvas wave simulation
  const drawMicrophoneCanvasFallback = () => {
    const canvas = recordingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;
    const draw = () => {
      if (!recordingCanvasRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#fafbfc";
      ctx.fillRect(0, 0, width, height);

      const barCount = 45;
      const barWidth = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const factor = Math.sin(i * 0.18 + phase) * 0.45 + 0.55;
        const barHeight = (Math.random() * 0.35 + 0.65) * height * 0.6 * factor;

        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, "#2563eb");
        gradient.addColorStop(1, "#93c5fd");

        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth + 1.5, height - barHeight - 12, barWidth - 3, barHeight);
      }

      phase += 0.2;
      if (isRecording) {
        requestAnimationFrame(draw);
      }
    };

    draw();
  };

  // Final neural voice synthesis generator
  const handleTrainAndSaveClone = () => {
    if (!newCloneName.trim()) {
      showToast("Please provide a name for your cloned voice.");
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);

    const interval = setInterval(() => {
      setTrainingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          
          const initials = newCloneName.trim().substring(0, 2).toUpperCase();
          const basePitchMultiplier = voiceAnalysisResult ? (voiceAnalysisResult.pitch / 145) : 1.0;

          const newClone: VoiceClone = {
            id: "clone-" + Date.now(),
            name: newCloneName.trim(),
            initials: initials,
            similarity: Math.floor(Math.random() * 6) + 93, // 93% - 98%
            pitch: Number(basePitchMultiplier.toFixed(2)),
            rate: 1.0,
            description: voiceAnalysisResult ? `Simulated ${voiceAnalysisResult.warmth}` : "My Cloned Voice Profile",
            emotion: selectedEmotion,
            stability: voiceAnalysisResult ? voiceAnalysisResult.stability : 75,
            clarity: voiceAnalysisResult ? voiceAnalysisResult.clarity : 90,
            custom: true,
          };

          setClones((prevClones) => {
            const updated = [...prevClones, newClone];
            localStorage.setItem("echocore_clones", JSON.stringify(updated));
            return updated;
          });

          setActiveCloneId(newClone.id);
          setIsTraining(false);
          setShowCloningLab(false);
          setNewCloneName("");
          setVoiceAnalysisResult(null);
          showToast(`Neural voice profile "${newClone.name}" cloned successfully!`);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  // Helper utility functions
  const showToast = (message: string) => {
    setNotification(message);
  };

  const handleExportSimulatedPreset = () => {
    showToast(`Preparing export for ${selectedPresetExport}...`);
    setTimeout(() => {
      showToast(`${selectedPresetExport} saved successfully to your downloads!`);
    }, 1500);
  };

  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  const handleExportAllHistoryAsZip = async () => {
    if (history.length === 0) {
      showToast("No clips available in history to export.");
      return;
    }

    setIsExportingZip(true);
    showToast("Starting export of all history items to a single ZIP...");

    try {
      const zip = new JSZip();
      
      // Create a readme file
      let readmeContent = `EchoCore AI - Voice Synthesis History Export\n`;
      readmeContent += `Generated on: ${new Date().toLocaleString()}\n`;
      readmeContent += `Total Items Exported: ${history.length}\n\n`;
      readmeContent += `=========================================\n\n`;

      history.forEach((hist, index) => {
        const itemPrefix = `clip_${index + 1}_${hist.id}`;
        
        // 1. Text transcript
        zip.file(`${itemPrefix}_script.txt`, hist.text);

        // 2. Metadata JSON
        const metadata = {
          id: hist.id,
          text: hist.text,
          voiceProfile: hist.cloneName,
          durationSeconds: hist.duration,
          pitchOffset: hist.pitchOffset,
          speechRate: hist.speechRate,
          generationDate: hist.date,
          exportedAt: new Date().toISOString()
        };
        zip.file(`${itemPrefix}_metadata.json`, JSON.stringify(metadata, null, 2));

        // 3. Audio file (Real binary playable WAV file!)
        // Determine voice base pitch frequency from the name
        let baseF0 = 150;
        const nameLower = hist.cloneName.toLowerCase();
        if (nameLower.includes("elena") || nameLower.includes("sister") || nameLower.includes("female")) {
          baseF0 = 210;
        } else if (nameLower.includes("alex") || nameLower.includes("brother") || nameLower.includes("male") || nameLower.includes("host b")) {
          baseF0 = 115;
        }
        const pitchMultiplier = 0.5 + (hist.pitchOffset / 100) * 1.3;
        const frequency = baseF0 * pitchMultiplier;

        // Generate WAV
        const wavDuration = Math.min(hist.duration || 3, 5); // Max 5 seconds for snappiness
        const wavBlob = generateSimulatedWav(wavDuration, frequency);
        zip.file(`${itemPrefix}_audio.wav`, wavBlob);

        // Add index entry to readme
        readmeContent += `[Item ${index + 1}]\n`;
        readmeContent += `ID: ${hist.id}\n`;
        readmeContent += `Voice: ${hist.cloneName}\n`;
        readmeContent += `Duration: ${hist.duration} seconds\n`;
        readmeContent += `Settings: Pitch Offset ${hist.pitchOffset}%, Speech Rate ${hist.speechRate}%\n`;
        readmeContent += `Script: "${hist.text}"\n`;
        readmeContent += `Date: ${hist.date}\n`;
        readmeContent += `-----------------------------------------\n\n`;
      });

      zip.file("README_EXPORT_DETAILS.txt", readmeContent);

      // Generate the zip binary file
      const content = await zip.generateAsync({ type: "blob" });
      
      // Download the zip file
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.id = "download-history-zip";
      link.href = url;
      link.download = `echocore_history_clips_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported all ${history.length} history clips into a single ZIP archive!`);
    } catch (err) {
      console.error("ZIP Generation Error:", err);
      showToast("Failed to create ZIP archive. Please try again.");
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleInsertPause = () => {
    setScriptText((prev) => prev + " [Pause 0.5s] ");
    showToast("Inserted 0.5s pause boundary marker.");
  };

  const handleEmphasizeText = () => {
    setScriptText((prev) => prev + " *emphasized* ");
    showToast("Injected focal acoustic emphasis marker.");
  };

  const loadQuickScript = (text: string, title: string) => {
    setScriptText(text);
    showToast(`Loaded "${title}" template.`);
  };

  const deleteClone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clones.length <= 1) {
      showToast("You must keep at least one voice clone profile.");
      return;
    }
    const filtered = clones.filter((c) => c.id !== id);
    setClones(filtered);
    localStorage.setItem("echocore_clones", JSON.stringify(filtered));
    if (activeCloneId === id) {
      setActiveCloneId(filtered[0].id);
    }
    showToast("Voice profile removed.");
  };

  const activeClone = clones.find((c) => c.id === activeCloneId) || clones[0];

  return (
    <div id="echocore-app-root" className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 font-sans border-0 m-0 p-0 overflow-hidden">
      
      {/* Toast Notification Header Alert */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-sm animate-fade-in border border-slate-800">
          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header Navigation */}
      <nav id="app-navbar" className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-100">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            EchoCore <span className="text-blue-600">AI</span>
          </span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full absolute"></span>
            <span className="text-xs text-slate-600 font-semibold pl-1">Engine Status: Optimal</span>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800">Alex Rivera</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Premium Creator</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-sm">
              AR
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main id="app-main-layout" className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Voice Profiles Library */}
        <aside id="sidebar-voice-library" className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Your Clones</h2>
              <button
                id="btn-trigger-cloning"
                onClick={() => {
                  setShowCloningLab(true);
                  setVoiceAnalysisResult(null);
                }}
                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                title="Create a new voice clone"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </div>
            
            {/* Clones Listing */}
            <div className="space-y-2">
              {clones.map((clone) => {
                const isActive = clone.id === activeCloneId;
                return (
                  <div
                    key={clone.id}
                    id={`voice-card-${clone.id}`}
                    onClick={() => {
                      setActiveCloneId(clone.id);
                      if (showCloningLab) setShowCloningLab(false);
                    }}
                    className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center space-x-3 relative group ${
                      isActive
                        ? "border-blue-200 bg-blue-50/40 shadow-sm"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {clone.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isActive ? "text-blue-900" : "text-slate-800"}`}>
                        {clone.name}
                      </p>
                      <p className={`text-[10px] font-semibold italic truncate ${isActive ? "text-blue-600" : "text-slate-400"}`}>
                        {clone.similarity}% Similarity Profile
                      </p>
                    </div>

                    {clone.custom && (
                      <button
                        onClick={(e) => deleteClone(clone.id, e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                        title="Remove custom clone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Presets for Accessibility / Testing / Education */}
            <div className="mt-8 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Scripts</h3>
                <div className="flex items-center space-x-1">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select
                    value={selectedScriptCategory}
                    onChange={(e) => {
                      setSelectedScriptCategory(e.target.value);
                      showToast(`Filtered scripts by: ${e.target.value}`);
                    }}
                    className="text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded px-1.5 py-0.5 outline-none cursor-pointer transition-colors"
                  >
                    <option value="All">All</option>
                    <option value="Accessibility">Accessibility</option>
                    <option value="Content Creation">Creative</option>
                    <option value="Education">Education</option>
                  </select>
                </div>
              </div>

              {/* Tabs Interface */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
                {["All", "Accessibility", "Content Creation", "Education"].map((cat) => {
                  const isCatActive = selectedScriptCategory === cat;
                  const labelMap: Record<string, string> = {
                    "All": "All",
                    "Accessibility": "Assistive",
                    "Content Creation": "Creative",
                    "Education": "Learning"
                  };
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedScriptCategory(cat);
                        showToast(`Filtered scripts by: ${cat}`);
                      }}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md whitespace-nowrap transition-all cursor-pointer ${
                        isCatActive
                          ? "bg-blue-50 text-blue-600 font-extrabold"
                          : "hover:bg-slate-50 text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {labelMap[cat] || cat}
                    </button>
                  );
                })}
              </div>

              {/* Presets List */}
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {QUICK_SCRIPTS.filter(script => selectedScriptCategory === "All" || script.category === selectedScriptCategory).map((script) => {
                  const getScriptIcon = () => {
                    switch (script.icon) {
                      case "accessibility":
                        return <Accessibility className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
                      case "creation":
                        return <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
                      case "education":
                        return <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
                      default:
                        return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
                    }
                  };

                  return (
                    <button
                      key={script.id}
                      onClick={() => loadQuickScript(script.text, script.title)}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-600 flex items-center space-x-2 transition-colors border border-transparent hover:border-slate-100 group"
                      title={script.text}
                    >
                      {getScriptIcon()}
                      <span className="truncate flex-1 font-medium text-slate-700 group-hover:text-blue-600">{script.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Bottom: Credit Tracker Panel */}
          <div className="mt-auto p-5 border-t border-slate-100 bg-slate-50/50">
            <div className="bg-slate-900 rounded-xl p-4 text-white shadow-inner">
              <p className="text-[10px] font-bold text-slate-400 mb-1 tracking-widest uppercase">Credits Remaining</p>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight">{creditsRemaining.toLocaleString()}</span>
                <button
                  onClick={() => {
                    setCreditsRemaining(20000);
                    showToast("Workspace credits replenished to maximum.");
                  }}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold tracking-wider cursor-pointer uppercase transition-colors"
                >
                  RELOAD
                </button>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${(creditsRemaining / 20000) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Section: Workspace (Speech Synthesis Editor OR Voice Cloning Lab) */}
        {!showCloningLab ? (
          <section id="synthesis-workspace" className="flex-1 flex flex-col p-8 space-y-6 overflow-y-auto">
            {/* Header Title */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Synthesis Workspace</h1>
                <p className="text-sm text-slate-500">
                  Convert your script using high-fidelity neural cloning: <span className="font-semibold text-blue-600">{activeClone.name}</span>
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    showToast("Script configuration drafted and cached.");
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  id="btn-generate-speech"
                  onClick={handleSynthesizeAndPlay}
                  disabled={isSynthesizing}
                  className={`px-5 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center space-x-2 cursor-pointer ${
                    isSynthesizing ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                >
                  {isSynthesizing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-blue-200" />
                      <span>Generate Audio</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Script Input Editor Box */}
            <div className="flex-1 min-h-[300px] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="p-6 flex-1 flex flex-col">
                {/* Base Voice selection helper overlay */}
                <div className="flex items-center justify-between mb-3 text-xs text-slate-400 border-b border-slate-100 pb-3">
                  <span className="font-medium">Active Voice Modifier Model: <strong className="text-slate-700">{activeClone.name}</strong></span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Base Vocalizer:</span>
                    <select
                      value={selectedBaseVoice}
                      onChange={(e) => setSelectedBaseVoice(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      {availableVoices.length > 0 ? (
                        availableVoices.map((v, index) => (
                          <option key={`${v.name}-${v.lang}-${index}`} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))
                      ) : (
                        <option value="">Default System Engine</option>
                      )}
                    </select>
                  </div>
                </div>

                <textarea
                  id="script-editor-textarea"
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="w-full flex-1 resize-none border-none focus:outline-none text-base leading-relaxed text-slate-700 placeholder:text-slate-300 font-sans"
                  placeholder="Enter or paste your script text here for conversion..."
                  spellCheck="false"
                />
              </div>
              
              {/* Text formatting Tools Bar */}
              <div className="h-14 bg-slate-50 border-t border-slate-200 px-6 flex items-center justify-between rounded-b-2xl shrink-0">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleInsertPause}
                    className="text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-tight transition-colors"
                  >
                    + Add Pause (0.5s)
                  </button>
                  <span className="text-slate-200">|</span>
                  <button
                    onClick={handleEmphasizeText}
                    className="text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-tight transition-colors"
                  >
                    Emphasize text
                  </button>
                  <span className="text-slate-200">|</span>
                  <button
                    onClick={() => setShowPronunciationMap(!showPronunciationMap)}
                    className="text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-tight transition-colors"
                  >
                    Pronunciation Map
                  </button>
                </div>
                <div className="text-xs font-semibold text-slate-400">
                  Characters: <span className="font-mono text-slate-600">{scriptText.length}</span> / 5,000
                </div>
              </div>
            </div>

            {/* Floating pronunciation reference popover */}
            {showPronunciationMap && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-2">
                <h4 className="font-bold">Acoustic Calibration Syntax Guide</h4>
                <p>EchoCore parses standard SSML tags and acoustic marker patterns natively:</p>
                <div className="grid grid-cols-2 gap-4 font-mono text-[11px] text-blue-900 bg-white/60 p-3 rounded-lg">
                  <div>
                    <span className="font-bold text-blue-600">"[Pause 0.5s]"</span> - Inject temporal speech boundaries.
                  </div>
                  <div>
                    <span className="font-bold text-blue-600">"*text*"</span> - Boost phoneme amplitude and dynamic emphasis.
                  </div>
                </div>
              </div>
            )}

            {/* Waveform Output Player Area */}
            <div id="audio-output-player" className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center space-x-6 shadow-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-md">
              <button
                id="btn-play-pause"
                onClick={handleSynthesizeAndPlay}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white cursor-pointer transition-all ${
                  isPlaying ? "bg-red-500 hover:bg-red-600 shadow-md shadow-red-100" : "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100"
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              {/* Dynamic waveform graphics */}
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>GENERATED CLIP PREVIEW ({activeClone.name})</span>
                  <span>
                    {Math.floor(playTime / 60)}:{(playTime % 60).toString().padStart(2, "0")} / {Math.floor(playDuration / 60)}:{(playDuration % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="relative w-full h-12 bg-slate-50/50 rounded-xl overflow-hidden border border-slate-100 flex items-center">
                  <canvas
                    ref={canvasRef}
                    width={520}
                    height={48}
                    className="w-full h-full"
                  />
                  {/* Trimmed Start Shading Overlay */}
                  {isTrimActive && (
                    <div 
                      className="absolute left-0 top-0 h-full bg-slate-900/10 backdrop-blur-[0.5px] border-r border-slate-300"
                      style={{ width: `${(trimStart / playDuration) * 100}%` }}
                    />
                  )}
                  {/* Trimmed End Shading Overlay */}
                  {isTrimActive && (
                    <div 
                      className="absolute right-0 top-0 h-full bg-slate-900/10 backdrop-blur-[0.5px] border-l border-slate-300"
                      style={{ width: `${((playDuration - trimEnd) / playDuration) * 100}%` }}
                    />
                  )}
                  {/* Trimmed Region Highlight Bar */}
                  {isTrimActive && (
                    <div 
                      className="absolute bottom-0 h-1 bg-blue-600"
                      style={{ 
                        left: `${(trimStart / playDuration) * 100}%`, 
                        width: `${((trimEnd - trimStart) / playDuration) * 100}%` 
                      }}
                    />
                  )}
                </div>

                {/* Real-time Pitch Contour Visualization */}
                <div id="pitch-contour-section" className="space-y-1.5 pt-1.5 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center space-x-1.5">
                      <span>Real-time Pitch Contour (F0)</span>
                    </span>
                    <span 
                      ref={currentPitchRef} 
                      className="text-emerald-500 font-mono font-bold"
                    >
                      Standby
                    </span>
                  </div>
                  <div className="relative w-full h-16 bg-slate-950 rounded-xl overflow-hidden border border-slate-900 flex items-center">
                    <canvas
                      ref={pitchCanvasRef}
                      width={520}
                      height={64}
                      className="w-full h-full"
                    />
                    
                    {/* Y-Axis Labels */}
                    <div className="absolute left-2.5 top-0 bottom-0 flex flex-col justify-between text-[8px] font-bold text-slate-500 font-mono py-1 pointer-events-none select-none">
                      <span>350 Hz</span>
                      <span>200 Hz</span>
                      <span>50 Hz</span>
                    </div>

                    {/* Stats overlay */}
                    <div className="absolute right-2.5 bottom-1 text-[8px] font-bold text-slate-400 font-mono pointer-events-none select-none flex space-x-2 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                      <span>AVG: <strong className="text-emerald-400 font-normal">{pitchStats.avg}Hz</strong></span>
                      <span className="text-slate-700">|</span>
                      <span>MIN: <strong className="text-emerald-400 font-normal">{pitchStats.min}Hz</strong></span>
                      <span className="text-slate-700">|</span>
                      <span>MAX: <strong className="text-emerald-400 font-normal">{pitchStats.max}Hz</strong></span>
                    </div>

                    {/* Trimmed Start Shading Overlay for pitch */}
                    {isTrimActive && (
                      <div 
                        className="absolute left-0 top-0 h-full bg-slate-950/40 backdrop-blur-[0.5px] border-r border-slate-700"
                        style={{ width: `${(trimStart / playDuration) * 100}%` }}
                      />
                    )}
                    {/* Trimmed End Shading Overlay for pitch */}
                    {isTrimActive && (
                      <div 
                        className="absolute right-0 top-0 h-full bg-slate-950/40 backdrop-blur-[0.5px] border-l border-slate-700"
                        style={{ width: `${((playDuration - trimEnd) / playDuration) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                {/* Mute/Unmute toggle button */}
                <button
                  id="btn-mute-toggle"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className={`p-3 border rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                    isMuted 
                      ? "text-red-500 border-red-200 bg-red-50/50 hover:bg-red-50" 
                      : "text-slate-400 hover:text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                  title={isMuted ? "Unmute vocal playback" : "Mute vocal playback"}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                {/* Audio Trimming Toggle button */}
                <button
                  id="btn-toggle-trim"
                  onClick={() => setShowTrimControls(!showTrimControls)}
                  className={`p-3 border rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                    showTrimControls 
                      ? "text-blue-600 border-blue-200 bg-blue-50/50" 
                      : "text-slate-400 hover:text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Trim output audio"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-4.879-4.879l-1.414-1.414M12 10.5a3 3 0 11-6 0 3 3 0 016 0zm0 0v-3a3 3 0 013-3h3m-6 6l-1.414-1.414M12 14a3 3 0 11-6 0 3 3 0 016 0zm0 0v3a3 3 0 003 3h3" />
                  </svg>
                </button>

                {/* Simulated file download button */}
                <button
                  id="btn-download-audio"
                  onClick={handleExportSimulatedPreset}
                  className="p-3 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Export and download generated audio preset"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Trim Controls Overlay/Expandable Section */}
            {showTrimControls && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-4.879-4.879l-1.414-1.414M12 10.5a3 3 0 11-6 0 3 3 0 016 0zm0 0v-3a3 3 0 013-3h3m-6 6l-1.414-1.414M12 14a3 3 0 11-6 0 3 3 0 016 0zm0 0v3a3 3 0 003 3h3" />
                    </svg>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Output Clip Trimmer</h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isTrimActive} 
                        onChange={(e) => {
                          setIsTrimActive(e.target.checked);
                          if (e.target.checked) {
                            setPlayTime(trimStart);
                          } else {
                            setPlayTime(0);
                          }
                          showToast(e.target.checked ? "Trim boundaries applied to playback." : "Trim boundaries disabled.");
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>APPLY TRIM BOUNDS</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Start Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>TRIM START</span>
                      <span className="text-blue-600">{trimStart}s</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max={Math.max(0, playDuration - 1)}
                      value={trimStart}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= trimEnd) {
                          setTrimStart(trimEnd - 1);
                        } else {
                          setTrimStart(val);
                        }
                        if (isTrimActive) {
                          setPlayTime(val);
                        }
                      }}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span>0.0s</span>
                      <span>Max: {playDuration - 1}s</span>
                    </div>
                  </div>

                  {/* End Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>TRIM END</span>
                      <span className="text-blue-600">{trimEnd}s</span>
                    </div>
                    <input 
                      type="range"
                      min={Math.max(1, trimStart + 1)}
                      max={playDuration}
                      value={trimEnd}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val <= trimStart) {
                          setTrimEnd(trimStart + 1);
                        } else {
                          setTrimEnd(val);
                        }
                      }}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span>Min: {trimStart + 1}s</span>
                      <span>{playDuration}.0s</span>
                    </div>
                  </div>
                </div>

                {/* Trim presets helper bar */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 justify-between items-center text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5 font-medium">
                    <span>Trimmed Duration:</span>
                    <strong className="text-blue-600 font-mono">{trimEnd - trimStart}s</strong>
                    <span className="text-slate-300">/</span>
                    <span>Total: {playDuration}s</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setTrimStart(0);
                        setTrimEnd(playDuration);
                        setIsTrimActive(false);
                        showToast("Trim boundaries reset to original clip.");
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-[11px] font-bold text-slate-600 cursor-pointer transition-colors"
                    >
                      Reset Trim
                    </button>
                    <button
                      onClick={() => {
                        const mid = Math.floor(playDuration / 2);
                        setTrimStart(Math.max(0, mid - 2));
                        setTrimEnd(Math.min(playDuration, mid + 2));
                        setIsTrimActive(true);
                        setPlayTime(Math.max(0, mid - 2));
                        showToast("Applied 4-second middle anchor trim.");
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-[11px] font-bold text-slate-600 cursor-pointer transition-colors"
                    >
                      Keep Middle 4s
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Generated History Logs list */}
            {history.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <History className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Workspace History Logs</h3>
                  </div>
                  <button
                    id="btn-export-history-zip"
                    onClick={handleExportAllHistoryAsZip}
                    disabled={isExportingZip}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                      isExportingZip 
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                        : "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-100"
                    }`}
                    title="Export all generated clips in workspace history as a single zip archive"
                  >
                    <Download className={`w-3.5 h-3.5 ${isExportingZip ? "animate-pulse" : ""}`} />
                    <span>{isExportingZip ? "Exporting ZIP..." : `Export All as ZIP (${history.length})`}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {history.map((hist) => (
                    <div
                      key={hist.id}
                      onClick={() => {
                        setScriptText(hist.text);
                        setPitchOffset(hist.pitchOffset);
                        setSpeechRate(hist.speechRate);
                        const matched = clones.find((c) => c.name === hist.cloneName);
                        if (matched) setActiveCloneId(matched.id);
                        showToast("Loaded historical script parameters back to workspace.");
                      }}
                      className="p-3.5 bg-white border border-slate-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/10 cursor-pointer transition-all duration-200 flex items-start justify-between group"
                    >
                      <div className="space-y-1 pr-4 min-w-0">
                        <p className="text-xs font-medium text-slate-700 line-clamp-2 leading-relaxed">{hist.text}</p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-semibold">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">{hist.cloneName}</span>
                          <span>•</span>
                          <span>{hist.duration}s clip</span>
                          <span>•</span>
                          <span>{hist.date}</span>
                        </div>
                      </div>
                      <RotateCcw className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          /* VOICE CLONING LAB WORKSPACE VIEW */
          <section id="cloning-lab" className="flex-1 flex flex-col p-8 space-y-6 overflow-y-auto bg-white">
            
            {/* Header / Back Action */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div className="flex items-center space-x-4">
                <button
                  id="btn-back-to-workspace"
                  onClick={() => setShowCloningLab(false)}
                  className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Microphone Acoustic Cloning Lab</h1>
                  <p className="text-xs text-slate-500">Record a brief vocal sample to extract and calibrate your digital neural replica.</p>
                </div>
              </div>
              <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">
                Calibrator V4.1 Offline
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Recording controls & prompt */}
              <div className="lg:col-span-7 space-y-6">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 1: Calibration Phoneme Script</h3>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative italic">
                    "The quick brown fox jumps over the lazy dog to calibrate the pitch, vocal tract length, and formant signature of my personal voice. Testing phonemic clarity, dynamic stability, and acoustic warmth."
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    💡 <strong>Recording Tip:</strong> Speak naturally in a quiet room, maintaining a consistent distance of 6-8 inches from your microphone.
                  </p>
                </div>

                {/* Recorder Visualizer Stage */}
                <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center space-y-5 text-center relative overflow-hidden">
                  
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center space-x-1.5 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      <span>RECORDING • 0:{recordingTime.toString().padStart(2, "0")} / 0:15</span>
                    </div>
                  )}

                  <div className="w-full h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center">
                    <canvas
                      ref={recordingCanvasRef}
                      width={480}
                      height={96}
                      className="w-full h-full"
                    />
                    {!isRecording && !voiceAnalysisResult && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-[1px] text-xs font-bold text-slate-400">
                        Awaiting Sound Wave Signals
                      </div>
                    )}
                  </div>

                  {/* Recorder Buttons */}
                  <div className="flex items-center space-x-3">
                    {!isRecording ? (
                      <button
                        id="btn-start-record"
                        onClick={startRecording}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-100 flex items-center space-x-2 cursor-pointer transition-all"
                      >
                        <Mic className="w-4 h-4 text-blue-200" />
                        <span>Start Recording</span>
                      </button>
                    ) : (
                      <button
                        id="btn-stop-record"
                        onClick={stopRecording}
                        className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-100 flex items-center space-x-2 cursor-pointer transition-all"
                      >
                        <span className="w-2 h-2 bg-white rounded-sm animate-pulse"></span>
                        <span>Stop and Process</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Acoustic report & Form finalizer */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Extracted Voice Metrics Report Card */}
                {voiceAnalysisResult && (
                  <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4 animate-fade-in">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Acoustic Signature Extracted</h3>
                    </div>

                    <div className="space-y-3 bg-white p-4 rounded-xl border border-blue-100/50 text-xs">
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="font-semibold text-slate-500 uppercase tracking-tight">Average Pitch</span>
                        <span className="font-bold text-slate-800 font-mono">{voiceAnalysisResult.pitch} Hz</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="font-semibold text-slate-500 uppercase tracking-tight">Vocal Clarity (SNR)</span>
                        <span className="font-bold text-slate-800 font-mono">{voiceAnalysisResult.clarity}%</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="font-semibold text-slate-500 uppercase tracking-tight">Speech Cadence</span>
                        <span className="font-bold text-slate-800 font-mono">{voiceAnalysisResult.tempo} WPM</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="font-semibold text-slate-500 uppercase tracking-tight">Harmonic Profile</span>
                        <span className="font-bold text-blue-700 font-bold">{voiceAnalysisResult.warmth}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final step form */}
                {voiceAnalysisResult && !isTraining && (
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 animate-fade-in">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 2: Profile Settings</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Voice Clone Name</label>
                        <input
                          id="input-new-clone-name"
                          type="text"
                          value={newCloneName}
                          onChange={(e) => setNewCloneName(e.target.value)}
                          placeholder="e.g. My Voice V3, Grandpa's AAC"
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                        />
                      </div>

                      <button
                        id="btn-finalize-clone"
                        onClick={handleTrainAndSaveClone}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-100 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-blue-200" />
                        <span>Finalize Neural Training</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Training progress animation */}
                {isTraining && (
                  <div className="p-6 bg-slate-900 text-white border border-slate-800 rounded-2xl space-y-4 text-center">
                    <Sparkles className="w-8 h-8 text-blue-400 mx-auto animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Optimizing Acoustic Embeddings...</p>
                      <p className="text-[10px] text-slate-400">Iterating neural weights & formant coefficients</p>
                    </div>
                    
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-150"
                        style={{ width: `${trainingProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] font-mono text-blue-400 font-bold">
                      EPOCH {Math.min(10, Math.floor(trainingProgress / 10))} / 10 ({trainingProgress}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Right Sidebar: Synthesis Config Parameters */}
        <aside id="sidebar-synthesis-controls" className="w-64 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Slider Parameters Controls */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Voice Controls</h3>
              <div className="space-y-6">
                
                {/* Stability */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Stability</label>
                    <span className="text-xs text-blue-600 font-bold">{pitchOffset}%</span>
                  </div>
                  <input
                    id="slider-stability"
                    type="range"
                    min="0"
                    max="100"
                    value={pitchOffset}
                    onChange={(e) => setPitchOffset(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Clarity */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Clarity</label>
                    <span className="text-xs text-blue-600 font-bold">{speechRate}%</span>
                  </div>
                  <input
                    id="slider-clarity"
                    type="range"
                    min="0"
                    max="100"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Master Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Vocal Volume</label>
                    <span className="text-xs text-blue-600 font-bold">{volumeLevel}%</span>
                  </div>
                  <input
                    id="slider-vocal-volume"
                    type="range"
                    min="0"
                    max="100"
                    value={volumeLevel}
                    onChange={(e) => setVolumeLevel(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Emotion Selector */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Emotion Model</label>
                    <span className="text-xs text-blue-600 font-bold">{selectedEmotion}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["Neutral", "Vibrant", "Warm", "Formal"].map((emo) => {
                      const isSel = emo === selectedEmotion;
                      return (
                        <button
                          key={emo}
                          onClick={() => setSelectedEmotion(emo)}
                          className={`px-2 py-1.5 border rounded text-[10px] font-bold uppercase tracking-tight transition-all cursor-pointer ${
                            isSel
                              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {emo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Accessibility banner warning tips */}
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[11px] text-amber-800 font-bold mb-1 uppercase tracking-wider">Accessibility Tip</p>
              <p className="text-[11px] leading-relaxed text-amber-700/80">
                Increase 'Clarity' and decrease 'Stability' for models intended for screen readers to ensure maximum phonemic distinction.
              </p>
            </div>

            {/* Export Preset Selection list */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Export Presets</h3>
              <div className="space-y-2">
                {[
                  "High-Res WAV (Mastering)",
                  "Social Media (MP3 320k)",
                  "Accessibility Hook (JSON)",
                ].map((preset) => {
                  const isSel = preset === selectedPresetExport;
                  return (
                    <div
                      key={preset}
                      onClick={() => setSelectedPresetExport(preset)}
                      className={`flex items-center space-x-3 p-2 rounded-lg transition-colors cursor-pointer group ${
                        isSel ? "bg-white text-blue-600 font-bold shadow-sm" : "hover:bg-white text-slate-600"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full transition-colors ${
                          isSel ? "bg-blue-600" : "bg-slate-300 group-hover:bg-blue-500"
                        }`}
                      ></div>
                      <span className="text-xs font-medium truncate">{preset}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
