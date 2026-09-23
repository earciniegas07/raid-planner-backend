const mongoose = require('mongoose');
const clanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  faction: { type: String, enum: ['Horde', 'Alliance', 'Neutral'], default: 'Neutral' },
  description: { type: String },
  banner: { type: String },
  roleLimits: {
    Tank: { type: Number, default: null },
    Healer: { type: Number, default: null },
    DPS: { type: Number, default: null },
    Support: { type: Number, default: null }
  }
}, { timestamps: true });
module.exports = mongoose.model('Clan', clanSchema);