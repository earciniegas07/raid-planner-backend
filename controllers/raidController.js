const Raid = require('../models/Raid');
const User = require('../models/User');
const Failure = require('../models/Failure');
const handleError = require('../utils/handleError');

function seniorityRank(user) {
  return (user.role === 'Officer' || user.role === 'Raid Leader') ? 0 : 1;
}

async function assignRolesForRaid(raid) {
  const pool = await User.find({ clanId: raid.clanId, role: { $ne: 'Bench' } });
  const required = raid.requiredRoles instanceof Map ? raid.requiredRoles : new Map(Object.entries(raid.requiredRoles || {}));
  const assignments = [];
  const usedIds = new Set();

  for (const [tacticalRole, count] of required.entries()) {
    const candidates = pool
      .filter(u => u.class === tacticalRole && !usedIds.has(String(u._id)))
      .sort((a, b) => {
        const diff = seniorityRank(a) - seniorityRank(b);
        return diff !== 0 ? diff : b.level - a.level;
      });

    candidates.slice(0, count).forEach(u => {
      assignments.push({ user: u._id, tacticalRole, source: 'auto' });
      usedIds.add(String(u._id));
    });
  }

  pool.forEach(u => {
    if (!usedIds.has(String(u._id))) {
      assignments.push({ user: u._id, tacticalRole: 'Bench', source: 'auto' });
    }
  });

  return assignments;
}

const getRaids = async (req, res) => {
  try {
    const raids = await Raid.find()
      .populate('clanId', 'name faction')
      .populate('assignments.user', 'gamertag class reliability');
    res.json(raids);
  } catch (error) {
    handleError(res, error);
  }
};

const createRaid = async (req, res) => {
  try {
    const raid = await Raid.create({ ...req.body, state: 'Planning', assignments: [] });
    res.status(201).json(raid);
  } catch (error) {
    handleError(res, error);
  }
};

const updateRaid = async (req, res) => {
  try {
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });
    if (raid.state !== 'Planning') {
      return res.status(400).json({ message: 'Solo se pueden editar raids en Planning' });
    }
    ['name', 'difficulty', 'startTime', 'durationHours', 'minPlayers', 'maxPlayers', 'clanId', 'requiredRoles']
      .forEach(k => { if (req.body[k] !== undefined) raid[k] = req.body[k]; });
    await raid.save();
    res.json(raid);
  } catch (error) {
    handleError(res, error);
  }
};

const deleteRaid = async (req, res) => {
  try {
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });
    await Failure.deleteMany({ raid: raid._id });
    await raid.deleteOne();
    res.json({ message: 'Raid eliminada' });
  } catch (error) {
    handleError(res, error);
  }
};

const overrideAssignment = async (req, res) => {
  try {
    const { tacticalRole } = req.body;
    if (!['Tank', 'Healer', 'DPS', 'Support', 'Bench'].includes(tacticalRole)) {
      return res.status(400).json({ message: 'Rol táctico inválido' });
    }
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });
    if (!['Locked', 'InProgress'].includes(raid.state)) {
      return res.status(400).json({ message: 'Solo se puede reasignar en raids Locked o InProgress' });
    }
    const assignment = raid.assignments.find(a => String(a.user) === req.params.userId);
    if (!assignment) return res.status(404).json({ message: 'Jugador no asignado a esta raid' });
    assignment.tacticalRole = tacticalRole;
    assignment.source = 'manual';
    await raid.save();
    res.json(assignment);
  } catch (error) {
    handleError(res, error);
  }
};

const changeRaidState = async (req, res) => {
  const { newState } = req.body;
  try {
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });

    const userRole = req.user.role;

    if (raid.state === 'Planning' && newState === 'Locked') {
      if (userRole !== 'Raid Leader' && userRole !== 'Officer') {
        return res.status(403).json({ message: 'Solo Raid Leader u Officer pueden lockear la raid' });
      }
      raid.assignments = await assignRolesForRaid(raid);
      raid.state = newState;
    } else if (raid.state === 'Locked' && newState === 'InProgress') {
      raid.state = newState;
    } else if (raid.state === 'InProgress' && (newState === 'Completed' || newState === 'Failed')) {
      if (userRole !== 'Raid Leader') {
        return res.status(403).json({ message: 'Solo el Raid Leader puede cerrar la raid' });
      }
      raid.state = newState;
      await applyRaidEndReliability(raid, newState);
    } else {
      return res.status(400).json({ message: `Transición ${raid.state} → ${newState} no permitida` });
    }

    await raid.save();
    res.json(raid);
  } catch (error) {
    handleError(res, error);
  }
};

async function applyRaidEndReliability(raid, result) {
  const userIds = raid.assignments.map(a => a.user);
  for (const userId of userIds) {
    const user = await User.findById(userId);
    if (!user) continue;
    if (result === 'Completed') {
      user.reliability += 10;
    } else if (result === 'Failed') {
      const penalty = user.role === 'Raid Leader' ? 15 : 5;
      user.reliability = Math.max(0, user.reliability - penalty);
    }
    await user.save();
  }
}

const addFailure = async (req, res) => {
  const { userId, type, severity } = req.body;
  try {
    if (!userId || !type || ![1, 3, 5].includes(Number(severity))) {
      return res.status(400).json({ message: 'userId, type y severity (1, 3 o 5) son obligatorios' });
    }
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });
    if (raid.state === 'Planning') {
      return res.status(400).json({ message: 'No se puede registrar un fallo en una raid en Planning' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Jugador no encontrado' });
    await Failure.create({ user: userId, raid: raid._id, type, severity: Number(severity) });
    const failures = await Failure.find({ user: userId, raid: raid._id });
    const total = failures.reduce((sum, f) => sum + f.severity, 0);
    if (total >= 8) {
      user.role = 'Bench';
      user.reliability = Math.max(0, user.reliability - 10);
      await user.save();
    }
    res.status(201).json({ message: 'Fallo registrado' });
  } catch (error) {
    handleError(res, error);
  }
};

const getRankings = async (req, res) => {
  try {
    const users = await User.find().sort({ reliability: -1 });
    const failures = await Failure.find().sort({ createdAt: -1 }).limit(10)
      .populate('user', 'gamertag');
    res.json({ mostReliable: users, recentFailures: failures });
  } catch (error) {
    handleError(res, error);
  }
};

// Check-in: el jugador confirma que sí va a estar en la raid ya lockeada
const checkIn = async (req, res) => {
  try {
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });
    if (!['Locked', 'InProgress'].includes(raid.state)) {
      return res.status(400).json({ message: 'Solo puedes hacer check-in cuando la raid está Locked o InProgress' });
    }
    const assignment = raid.assignments.find(a => String(a.user) === String(req.user._id));
    if (!assignment) return res.status(404).json({ message: 'No estás asignado a esta raid' });

    assignment.attendance = 'Confirmed';
    await raid.save();
    res.json({ message: 'Check-in registrado', assignment });
  } catch (error) {
    handleError(res, error);
  }
};

// Checkout: el jugador avisa que no va a poder ir
const checkOut = async (req, res) => {
  try {
    const raid = await Raid.findById(req.params.id);
    if (!raid) return res.status(404).json({ message: 'Raid no encontrada' });
    const assignment = raid.assignments.find(a => String(a.user) === String(req.user._id));
    if (!assignment) return res.status(404).json({ message: 'No estás asignado a esta raid' });

    assignment.attendance = 'Declined';
    await raid.save();

    // Si se baja después de lockeada, cuenta como fallo leve de compromiso
    if (raid.state === 'Locked') {
      await Failure.create({ user: req.user._id, raid: raid._id, type: 'Checkout tardío', severity: 3 });
    }

    res.json({ message: 'Checkout registrado', assignment });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getRaids,
  createRaid,
  updateRaid,
  deleteRaid,
  overrideAssignment,
  changeRaidState,
  addFailure,
  getRankings,
  checkIn,
  checkOut,
};