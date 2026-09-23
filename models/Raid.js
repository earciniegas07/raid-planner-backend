const mongoose = require('mongoose');
const raidSchema = new mongoose.Schema({
  name: { type: String, required: true },
  difficulty: { type: String, enum: ['Normal', 'Heroic', 'Mythic', 'Impossible'], default: 'Normal' },
  state: { type: String, enum: ['Planning', 'Locked', 'InProgress', 'Completed', 'Failed'], default: 'Planning' },
  startTime: { type: Date, required: true },
  durationHours: { type: Number, required: true },
  minPlayers: { type: Number, default: 10 },
  maxPlayers: { type: Number, default: 20 },
  clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true },
  requiredRoles: { type: Map, of: Number, default: {} },
  assignments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tacticalRole: { type: String },
    source: { type: String, enum: ['auto', 'manual'], default: 'auto' }
  }]
}, { timestamps: true });
module.exports = mongoose.model('Raid', raidSchema);