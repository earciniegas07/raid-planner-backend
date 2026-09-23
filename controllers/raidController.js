const Raid = require('../models/Raid');
const User = require('../models/User');
const Failure = require('../models/Failure');

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
    res.status(500).json({ message: error.message });
  }
};

const createRaid = async (req, res) => {
  try {
    const raid = await Raid.create({ ...req.body, state: 'Planning' });
    res.status(201).json(raid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Espejo de changeRaidState del frontend
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
    res.status(500).json({ message: error.message });
  }
};

// A diferencia del frontend (que afecta a TODOS los usuarios), esto solo
// impacta a quienes quedaron asignados en la raid — el otro comportamiento
// parece un bug del mock, vale la pena avisarle a tu compañero.
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

// Fallómetro
const addFailure = async (req, res) => {
  const { userId, type, severity } = req.body;
  try {
    await Failure.create({ user: userId, raid: req.params.id, type, severity });

    const failures = await Failure.find({ user: userId, raid: req.params.id });
    const total = failures.reduce((sum, f) => sum + f.severity, 0);

    if (total >= 8) {
      const user = await User.findById(userId);
      user.role = 'Bench';
      user.reliability = Math.max(0, user.reliability - 10);
      await user.save();
    }

    res.status(201).json({ message: 'Fallo registrado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Espejo de HallOfShame.jsx
const getRankings = async (req, res) => {
  try {
    const users = await User.find().sort({ reliability: -1 });
    const failures = await Failure.find().sort({ createdAt: -1 }).limit(10)
      .populate('user', 'gamertag');
    res.json({ mostReliable: users, recentFailures: failures });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getRaids, createRaid, changeRaidState, addFailure, getRankings };