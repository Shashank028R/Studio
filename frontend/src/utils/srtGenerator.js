/**
 * Generates an SRT subtitle string from script scenes
 * @param {Array} scenes - List of scenes with narratorText and duration
 * @returns {string} - Formatted SRT file content
 */
export function generateSRT(scenes) {
  if (!scenes || !Array.isArray(scenes)) return '';

  let srtContent = '';
  let runningTime = 0; // cumulative seconds

  scenes.forEach((scene, index) => {
    const sceneNum = index + 1;
    const duration = scene.duration || 6;
    const startTime = runningTime;
    const endTime = runningTime + duration;
    
    runningTime = endTime;

    srtContent += `${sceneNum}\n`;
    srtContent += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
    srtContent += `${scene.narratorText}\n\n`;
  });

  return srtContent;
}

/**
 * Formats a duration in seconds to HH:MM:SS,mmm SRT format
 * @param {number} totalSeconds 
 * @returns {string}
 */
function formatSrtTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);

  const pad = (num, size = 2) => String(num).padStart(size, '0');

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Utility to download text or binary contents as a local file
 * @param {Blob|string} content 
 * @param {string} filename 
 * @param {string} contentType 
 */
export function downloadBlob(content, filename, contentType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
