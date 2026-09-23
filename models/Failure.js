const mongoose = require('mongoose');
const failureSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  raid: { type: mongoose.Schema.Types.ObjectId, ref: 'Raid', required: true },
  type: { type: String, required: true },
  severity: { type: Number, enum: [1, 3, 5], required: true }
}, { timestamps: true });
module.exports = mongoose.model('Failure', failureSchema);