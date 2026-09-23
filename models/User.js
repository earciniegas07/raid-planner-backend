const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gamertag: { type: String, required: true },
  class: { type: String, enum: ['Tank', 'Healer', 'DPS', 'Support'], required: true },
  region: { type: String },
  level: { type: Number, default: 1 },
  role: { type: String, enum: ['Raid Leader', 'Officer', 'Raider', 'Bench'], default: 'Raider' },
  reliability: { type: Number, default: 100 },
  clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null }
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);