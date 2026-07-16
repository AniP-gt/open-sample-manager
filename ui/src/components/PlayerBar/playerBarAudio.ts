// Single persistent Audio element shared across path changes to avoid
// WebKit media resource leaks from repeated new Audio() / destroy cycles.
export const sharedPlayerBarAudio = (() => {
  const audio = new Audio();
  audio.preload = "metadata";
  return audio;
})();
