'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_VIDEO = path.resolve(__dirname, '../../public/videos/sunupilot-presentation.mp4');
const DEFAULT_CAPTIONS = path.resolve(__dirname, '../../public/videos/sunupilot-presentation-fr.vtt');
const DEFAULT_POSTER = path.resolve(__dirname, '../../public/images/sunupilot-presentation-poster.svg');
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MIN_VIDEO_BYTES = 100 * 1024;

function validateVideoAssets(options = {}) {
  const videoPath = options.videoPath || DEFAULT_VIDEO;
  const captionsPath = options.captionsPath || DEFAULT_CAPTIONS;
  const posterPath = options.posterPath || DEFAULT_POSTER;
  const errors = [];

  for (const [label, filePath] of [
    ['MP4 de présentation', videoPath],
    ['Sous-titres français', captionsPath],
    ['Affiche de présentation', posterPath]
  ]) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      errors.push(label + ' introuvable : ' + filePath);
    }
  }

  if (errors.length) return { valid: false, errors };

  const stat = fs.statSync(videoPath);
  if (stat.size < MIN_VIDEO_BYTES) {
    errors.push('Le MP4 est trop petit pour être un export vidéo complet (minimum 100 Ko).');
  }
  if (stat.size > MAX_VIDEO_BYTES) {
    errors.push('Le MP4 dépasse la limite de livraison de 80 Mio.');
  }

  const video = fs.readFileSync(videoPath);
  if (video.toString('ascii', 4, 8) !== 'ftyp') {
    errors.push('Le fichier ne possède pas de signature MP4 valide (ftyp).');
  }
  if (video.indexOf(Buffer.from('moov')) < 0 || video.indexOf(Buffer.from('mdat')) < 0) {
    errors.push('Le MP4 doit contenir les boîtes moov et mdat.');
  }

  const captions = fs.readFileSync(captionsPath, 'utf8').replace(/^\uFEFF/, '');
  if (!/^WEBVTT(?:\s|$)/.test(captions)) {
    errors.push('Le fichier de sous-titres doit commencer par WEBVTT.');
  }
  if (!/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(captions)) {
    errors.push('Aucun repère temporel WebVTT valide n’a été trouvé.');
  }

  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    videoBytes: stat.size,
    captionsCues: (captions.match(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/g) || []).length
  };
}

if (require.main === module) {
  const result = validateVideoAssets();
  if (!result.valid) {
    console.error('Échec de validation du média Sunupilot :');
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
  } else {
    console.log('Média Sunupilot valide.');
    console.log('MP4 : ' + (result.videoBytes / (1024 * 1024)).toFixed(2) + ' Mio');
    console.log('Repères de sous-titres : ' + result.captionsCues);
  }
}

module.exports = { validateVideoAssets };
