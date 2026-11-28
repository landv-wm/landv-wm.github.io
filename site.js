const library = {
  prediction: {
    title: 'GT vs. prediction',
    description: 'One real frame conditions 16 future frames. Six camera views are paired with their LiDAR projections, with ground truth above and LandV below.',
    clips: [
      ['prediction-0796-152', 'scene-0796_152'],
      ['prediction-0039-144', 'scene-0039_144'],
      ['prediction-0521-064', 'scene-0521_064'],
      ['prediction-0524-208', 'scene-0524_208']
    ]
  },
  rollout: {
    title: 'Autoregressive rollout',
    description: 'Starting from one real frame, LandV predicts 48 future frames in three segments. Each segment takes the previous prediction’s final RGB and LiDAR frame as its input.',
    clips: [
      ['rollout-0557-112', 'scene-0557_112'],
      ['rollout-0799-160', 'scene-0799_160'],
      ['rollout-0036-168', 'scene-0036_168']
    ]
  },
  uniscene: {
    title: 'UniScene comparison',
    description: 'Two scenes compare ground truth, UniScene, and LandV. UniScene’s single-call output covers t1–t7; its last frame stays on screen while LandV continues to t16.',
    clips: [['uniscene-comparison', 'scene-0560_064 and scene-0972_008']]
  },
  control: {
    title: 'Scene control',
    description: 'Compare the original generation with an added car, a left turn, a change in weather, and the combined controls. The final sequence pairs front-camera RGB with its LiDAR projection.',
    clips: [['scene-control', 'scene-0035_048']]
  }
};

const player = document.getElementById('player');
const choices = document.getElementById('clips');
const heading = document.getElementById('clip-heading');
const groupButtons = [...document.querySelectorAll('[data-group]')];
const rateButtons = [...document.querySelectorAll('[data-rate]')];
const lastClip = new Map();
const slowRate = 1 / 3;
let selectedGroup;
let rate = slowRate;

function applyRate() {
  player.defaultPlaybackRate = rate;
  player.playbackRate = rate;
  for (const button of rateButtons) {
    button.setAttribute('aria-pressed', String(Math.abs(Number(button.dataset.rate) - rate) < .001));
  }
}
for (const button of rateButtons) {
  button.addEventListener('click', () => {
    rate = Number(button.dataset.rate);
    applyRate();
  });
}
player.addEventListener('loadedmetadata', applyRate);
player.addEventListener('ratechange', () => {
  if (player.readyState && player.playbackRate !== rate) {
    rate = player.playbackRate;
    applyRate();
  }
});

function selectClip(group, id, updateAddress = true) {
  const category = library[group];
  const [key, name] = category.clips.find(([key]) => key === id) || category.clips[0];
  const newGroup = group !== selectedGroup;
  const resume = !player.paused && !player.ended;
  lastClip.set(group, key);
  selectedGroup = group;
  for (const button of groupButtons) button.setAttribute('aria-pressed', String(button.dataset.group === group));
  if (newGroup) {
    choices.replaceChildren();
    if (category.clips.length > 1) {
      for (const [clipId, scene] of category.clips) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'clip';
        button.dataset.clip = clipId;
        const thumb = document.createElement('img');
        thumb.src = 'assets/images/' + clipId + '-thumb.webp';
        thumb.alt = '';
        button.append(thumb, document.createTextNode(scene));
        button.addEventListener('click', () => selectClip(group, clipId));
        choices.append(button);
      }
    }
  }
  for (const button of choices.children) button.setAttribute('aria-pressed', String(button.dataset.clip === key));
  heading.replaceChildren(document.createTextNode(category.title));
  const sceneName = document.createElement('span');
  sceneName.textContent = name;
  heading.append(sceneName);
  document.getElementById('clip-description').textContent = category.description;
  const path = 'assets/videos/' + key;
  if (player.getAttribute('src') !== path + '.mp4') {
    player.pause();
    player.poster = path + '.jpg';
    player.src = path + '.mp4';
    applyRate();
    if (resume) player.play().catch(() => {});
  }
  player.setAttribute('aria-label', category.title + ' · ' + name);
  if (updateAddress) {
    const url = new URL(window.location.href);
    url.searchParams.set('clip', key);
    history.replaceState(null, '', url);
  }
}
for (const button of groupButtons) {
  button.addEventListener('click', () => {
    const group = button.dataset.group;
    if (group !== selectedGroup) selectClip(group, lastClip.get(group));
  });
}
const request = new URLSearchParams(location.search).get('clip');
const match = Object.keys(library).find(group => library[group].clips.some(([key]) => key === request));
selectClip(match || 'prediction', request, false);
applyRate();

const hero = document.getElementById('hero-sequence');
const heroToggle = document.getElementById('hero-toggle');
const heroSpeed = document.getElementById('hero-speed');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const heroRows = Array.from(document.querySelectorAll('.hero-stage canvas'), canvas => canvas.getContext('2d'));
const sliders = document.querySelectorAll('.hero-slider input');
const poster = new Image();
let showPoster = true;

function drawComparison() {
  const source = showPoster ? poster : hero;
  if (showPoster ? !poster.naturalWidth : hero.readyState < 2) return;
  // The packed video alternates RGB and LiDAR strips for each pair of views.
  for (const [index, paint] of heroRows.entries()) {
    const {width, height} = paint.canvas;
    const panelWidth = width / 2;
    const rgbY = index * 2 * height;
    const split = Math.round(panelWidth * sliders[0].valueAsNumber / 100);
    const lidarWidth = panelWidth - split;
    paint.drawImage(source, 0, rgbY, width, height, 0, 0, width, height);
    if (lidarWidth > 0) {
      for (const column of [0, 1]) {
        const x = column * panelWidth + split;
        paint.drawImage(source, x, rgbY + height, lidarWidth, height, x, 0, lidarWidth, height);
      }
    }
  }
}
function syncSliders(value) {
  for (const slider of sliders) {
    slider.value = value;
    slider.setAttribute('aria-valuetext', value + '% RGB, ' + (100 - value) + '% LiDAR');
    slider.parentElement.style.setProperty('--split', value + '%');
  }
  drawComparison();
}
for (const slider of sliders) {
  slider.addEventListener('input', () => syncSliders(slider.value));
}
syncSliders(sliders[0].value);
for (const row of document.querySelectorAll('.hero-sliders')) row.hidden = false;
poster.addEventListener('load', drawComparison);
poster.src = hero.poster;

hero.addEventListener('playing', () => {
  showPoster = false;
  drawComparison();
});
hero.addEventListener('seeked', drawComparison);
if (hero.requestVideoFrameCallback) {
  function onFrame() {
    drawComparison();
    hero.requestVideoFrameCallback(onFrame);
  }
  hero.requestVideoFrameCallback(onFrame);
} else {
  let animation;
  function animate() {
    drawComparison();
    animation = requestAnimationFrame(animate);
  }
  hero.addEventListener('playing', () => {
    cancelAnimationFrame(animation);
    animate();
  });
  hero.addEventListener('pause', () => cancelAnimationFrame(animation));
}

function setHeroSpeed() {
  const speed = heroSpeed.value === 'slow' ? slowRate : 1;
  hero.defaultPlaybackRate = speed;
  hero.playbackRate = speed;
}
function updateHeroToggle() {
  heroToggle.textContent = hero.paused ? 'Play' : 'Pause';
}
function playHero() {
  hero.play().catch(updateHeroToggle);
}
hero.controls = false;
heroToggle.parentElement.hidden = false;
heroToggle.addEventListener('click', () => {
  if (hero.paused) playHero();
  else hero.pause();
});
heroSpeed.addEventListener('change', setHeroSpeed);
hero.addEventListener('loadedmetadata', setHeroSpeed);
hero.addEventListener('play', updateHeroToggle);
hero.addEventListener('pause', updateHeroToggle);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) hero.pause();
});
heroSpeed.value = 'slow';
setHeroSpeed();
if (!reducedMotion.matches) playHero();

const modal = document.getElementById('figure-dialog');
const fullFigure = document.getElementById('full-figure');
for (const link of document.querySelectorAll('[data-figure]')) {
  link.addEventListener('click', event => {
    if (typeof modal.showModal !== 'function' || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    fullFigure.src = link.href;
    fullFigure.alt = link.querySelector('img').alt;
    document.getElementById('dialog-title').textContent = link.closest('figure').querySelector('figcaption').textContent;
    modal.showModal();
  });
}
document.getElementById('close-figure').addEventListener('click', () => modal.close());
modal.addEventListener('click', event => { if (event.target === modal) {
  const box = modal.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close();
}});
