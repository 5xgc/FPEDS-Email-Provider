import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { VideoCanvas, VideoPausedContext, type VideoAspectRatio, useVideoPlayer } from '@/lib/video';
import { AnimatePresence } from 'framer-motion';
import { Shot01 } from './video_scenes/Shot01';
import { Shot02 } from './video_scenes/Shot02';
import { Shot03 } from './video_scenes/Shot03';
import { Shot04 } from './video_scenes/Shot04';
import { Shot05 } from './video_scenes/Shot05';
import { Shot06 } from './video_scenes/Shot06';
import { Shot07 } from './video_scenes/Shot07';

export const SCENE_DURATIONS = {
  shot01: 3500,
  shot02: 4000,
  shot03: 4500,
  shot04: 4000,
  shot05: 4000,
  shot06: 5000,
  shot07: 5000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const SCENE_COMPONENTS: Record<string, ComponentType> = {
  shot01: Shot01,
  shot02: Shot02,
  shot03: Shot03,
  shot04: Shot04,
  shot05: Shot05,
  shot06: Shot06,
  shot07: Shot07,
};
const BACKGROUNDS = ['#080808', '#101010', '#090909', '#0c0c0c', '#111111', '#0a0a0a', '#e9e5e0'];
const SCENE_START_SECONDS = Object.fromEntries(
  Object.keys(SCENE_DURATIONS).map((key, index, keys) => [
    key,
    keys.slice(0, index).reduce((sum, priorKey) => sum + SCENE_DURATIONS[priorKey as keyof typeof SCENE_DURATIONS], 0) / 1000,
  ]),
) as Record<string, number>;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const sceneIndex = useMemo(
    () => Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey),
    [baseSceneKey],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    if (paused) {
      audio.pause();
      return;
    }
    const offset = SCENE_START_SECONDS[baseSceneKey] ?? 0;
    try {
      if (Number.isFinite(audio.duration) && offset < audio.duration) {
        audio.currentTime = offset;
      }
    } catch {
      // Some browsers do not allow seeking until the audio metadata loads.
    }
    void audio.play().catch(() => undefined);
  }, [baseSceneKey, currentScene, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: BACKGROUNDS[Math.max(0, sceneIndex)] }}>
        <div className="absolute inset-0 h-full w-full overflow-hidden" style={{ backgroundColor: BACKGROUNDS[Math.max(0, sceneIndex)] }}>
          <AnimatePresence mode="sync" initial={false}>
            {SceneComponent && <SceneComponent key={currentSceneKey} />}
          </AnimatePresence>
        </div>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/moraltown-instrumental.mp3`}
          autoPlay
          loop
          preload="auto"
          muted={muted}
          aria-hidden="true"
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
