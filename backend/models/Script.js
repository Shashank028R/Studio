import mongoose from 'mongoose';

const sceneSchema = new mongoose.Schema({
  sceneNumber: {
    type: Number,
    required: true
  },
  narratorText: {
    type: String,
    required: true
  },
  visualPrompt: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  episodeTimestampStart: {
    type: Number,
    required: true
  },
  audioBase64: {
    type: String,
    default: ''
  }
});

const scriptSchema = new mongoose.Schema({
  animeTitle: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  tone: {
    type: String,
    required: true
  },
  scenes: [sceneSchema],
  footageSuggestions: {
    type: String,
    default: 'General action scenes and character highlights from the anime series.'
  },
  videoType: {
    type: String,
    enum: ['short', 'long'],
    default: 'short'
  },
  audioBase64: {
    type: String,
    default: ''
  },
  metadata: {
    youtubeTitle: { type: String, default: '' },
    youtubeCaption: { type: String, default: '' },
    youtubeDescription: { type: String, default: '' },
    youtubeTags: { type: String, default: '' }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Script = mongoose.model('Script', scriptSchema);

export default Script;
