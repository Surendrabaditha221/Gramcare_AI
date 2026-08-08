/**
 * GramCare AI - Startup Audio Handler
 * Plays local MP3 audio from /audio/gramcare-startup.mp3
 * Safely handles browser autoplay policies without error logs or app blocking.
 */

export function playGramCareStartupSound(): () => void {
  let audio: HTMLAudioElement | null = null;

  try {
    audio = new Audio('/audio/gramcare-startup.mp3');
    audio.volume = 0.55; // 55% volume as requested
    audio.loop = false;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented playback — continue silently without error
      });
    }
  } catch {
    // Silent catch for environment restrictions
  }

  // Cleanup function returned for component unmount
  return () => {
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Silent cleanup error catch
      }
    }
  };
}
