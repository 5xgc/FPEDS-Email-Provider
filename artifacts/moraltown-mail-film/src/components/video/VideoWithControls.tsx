import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  shot01: { title: 'Brand hook', filePath: 'src/components/video/video_scenes/Shot01.tsx' },
  shot02: { title: 'Access-key sign-in', filePath: 'src/components/video/video_scenes/Shot02.tsx' },
  shot03: { title: 'Inbox and folders', filePath: 'src/components/video/video_scenes/Shot03.tsx' },
  shot04: { title: 'Message organization', filePath: 'src/components/video/video_scenes/Shot04.tsx' },
  shot05: { title: 'Send and receive', filePath: 'src/components/video/video_scenes/Shot05.tsx' },
  shot06: { title: 'Account and privacy', filePath: 'src/components/video/video_scenes/Shot06.tsx' },
  shot07: { title: 'Windows desktop app', filePath: 'src/components/video/video_scenes/Shot07.tsx' },
};

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath) return;
  window.parent.postMessage({
    type: 'REPLIT_VIDEO_SCENE_SELECTED',
    payload: {
      sceneIndex: index,
      sceneCount: sceneKeys.length,
      sceneTitle: details.title || key,
      filePath: details.filePath,
      lineNumber: 1,
    },
  }, '*');
}

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  paused: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}

function ControlBar({
  visible,
  collapsed,
  locked,
  paused,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  onTogglePause,
  onToggleLock,
  onToggleMute,
  onJumpTo,
  onToggleCollapsed,
}: ControlBarProps) {
  return (
    <div
      className={`flex items-center gap-1.5 border-t border-white/10 bg-black/65 px-2 py-2 backdrop-blur-xl transition-all duration-200 ease-out sm:gap-3 sm:px-5 sm:py-4 ${
        visible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onTogglePause}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14"
        title={paused ? 'Play' : 'Pause'}
        aria-label={paused ? 'Play' : 'Pause'}
      >
        {paused ? <Play className="h-6 w-6 sm:h-8 sm:w-8" /> : <Pause className="h-6 w-6 sm:h-8 sm:w-8" />}
      </button>
      <button
        type="button"
        onClick={onToggleLock}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14 ${
          locked ? 'bg-white/15 text-white hover:bg-white/25' : 'text-white/65 hover:bg-white/10 hover:text-white'
        }`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="h-6 w-6 sm:h-8 sm:w-8" />
      </button>
      <button
        type="button"
        onClick={onToggleMute}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14"
        title={muted ? 'Unmute music' : 'Mute music'}
        aria-label={muted ? 'Unmute music' : 'Mute music'}
        aria-pressed={muted}
      >
        {muted ? <VolumeX className="h-5 w-5 sm:h-7 sm:w-7" /> : <Volume2 className="h-5 w-5 sm:h-7 sm:w-7" />}
      </button>
      <div className="hidden h-10 w-px shrink-0 bg-white/15 sm:block" aria-hidden="true" />
      <PlaybackStatus
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        activeStartTime={activeStartTime}
        totalDuration={totalDuration}
        tick={tick}
        paused={paused}
        onJumpTo={onJumpTo}
      />
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="h-7 w-7 sm:h-10 sm:w-10" /> : <ChevronDown className="h-7 w-7 sm:h-10 sm:w-10" />}
      </button>
    </div>
  );
}

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);

  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - start);
    }, PROGRESS_TICK_MS);
    return () => {
      window.clearInterval(timer);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [tick, paused]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            type="button"
            onClick={() => onJumpTo(index)}
            className="relative h-2 min-h-[10px] min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all hover:h-3 hover:bg-white/30 sm:h-3 sm:hover:h-4"
            aria-label={`Jump to scene ${index + 1}: ${SCENE_DETAILS[key]?.title ?? key}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/90 transition-[width] duration-100"
              style={{ width: index === activeIndex ? `${progress * 100}%` : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="shrink-0 font-mono text-xs tabular-nums text-white/65 sm:text-xl" aria-label={`Scene ${activeIndex + 1} of ${sceneKeys.length}`}>
        {activeIndex + 1}/{sceneKeys.length}
      </div>
      <div
        className="hidden min-w-[11ch] shrink-0 text-right font-mono text-sm tabular-nums text-white/80 sm:block sm:text-xl"
        role="timer"
        aria-label={`Playback time ${formatPlaybackTime(totalElapsed)} of ${formatPlaybackTime(totalDuration)}`}
      >
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

function formatPlaybackTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const [muted, setMuted] = useState(false);
  const {
    sceneKeys,
    activeIndex,
    locked,
    paused,
    mountKey,
    tick,
    durations,
    activeDuration,
    activeStartTime,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
    togglePause,
  } = useSceneControls(SCENE_DURATIONS);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);
  const handlePointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      if (!value) {
        setHovering(false);
        setTapPinned(false);
      }
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!paused) return;
    const frozen = document.getAnimations().filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [paused]);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (sensorRef.current && !sensorRef.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="w-full flex-1" aria-hidden="true" />
        <ControlBar
          visible={!collapsed || hovering || tapPinned}
          collapsed={collapsed}
          locked={locked}
          paused={paused}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          activeStartTime={activeStartTime}
          totalDuration={totalDuration}
          tick={tick}
          onTogglePause={togglePause}
          onToggleLock={toggleLock}
          onToggleMute={() => setMuted((value) => !value)}
          onJumpTo={handleJumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}
