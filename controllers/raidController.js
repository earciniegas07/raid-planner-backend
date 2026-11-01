const Raid = require('../models/Raid');
const Clan = require('../models/Clan');
const User = require('../models/User');
const Failure = require('../models/Failure');
const handleError = require('../utils/handleError');
const { assignRolesForRaid } = require('../utils/assignRoles');

const ADMIN_ROLES = ['Raid Leader', 'Officer'];
const RAID_FIELDS = ['name', 'difficulty', 'startTime', 'durationHours', 'minPlayers', 'maxPlayers', 'clanId', 'requiredRoles'];

// Solo deja pasar los campos permitidos (evita mass assignment de state/assignments)
const pickRaidFields = (body) =>
  RAID_FIELDS.reduce((acc, k) => {
    if (body[k] !== undefined) acc[k] = body[k];
    return acc;
  }, {});

const populateRaid = (query) =>
  query
    .populate('clanId', 'name faction')
    .populate('assignments.user', 'gamertag class reliability');

const getRaids = async (req, res) => {
  try {
    const raids = await populateRaid(Raid.find().sort({ startTime: 1 }));
    res.json(raids);
  } catch (error) {
    handleError(res, error);
  }
};

const createRaid = async (req, res) => {
  try {
    const data = pickRaidFields(req.body);
    if (Number(data.minPlayers) > Number(data.maxPlayers)) {
      return res.status(400).json({ message: 'El mínimo de jugadores no puede superar al máximo' });
    }
    if (!data.clanId || !(await Clan.exists({ _id: data.clanId }))) {
      return res.status(400).json({ message: 'Debes elegir un clan válido' });
    }
    const raid = await Raid.create({ ...data, state: 'Planning', assignments: [] });
    res.status(201).json(await populateRaid(Raid.findById(raid._id)));
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
    const data = pickRaidFields(req.body);
    Object.keys(data).forEach(k => { raid[k] = data[k]; });
    if (raid.minPlayers > raid.maxPlayers) {
      return res.status(400).json({ message: 'El mínimo de jugadores no puede superar al máximo' });
    }
    if (data.clanId && !(await Clan.exists({ _id: data.clanId }))) {
      return res.status(400).json({ message: 'Clan no válido' });
    }
    await raid.save();
    res.json(await populateRaid(Raid.findById(raid._id)));
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
    const isAdmin = ADMIN_ROLES.includes(userRole);

    if (raid.state === 'Planning' && newState === 'Locked') {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Solo Raid Leader u Officer pueden lockear la raid' });
      }
      raid.assignments = await assignRolesForRaid(raid);
      raid.state = newState;
    } else if (raid.state === 'Locked' && newState === 'InProgress') {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Solo Raid Leader u Officer pueden iniciar la raid' });
      }
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
    res.json(await populateRaid(Raid.findById(raid._id)));
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
    if (!raid.assignments.some(a => String(a.user) === String(userId))) {
      return res.status(400).json({ message: 'Ese jugador no está asignado a esta raid' });
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
    res.status(201).json({ message: 'Fallo registrado', benched: total >= 8 });
  } catch (error) {
    handleError(res, error);
  }
};

const getRankings = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ reliability: -1 });
    const failures = await Failure.find().sort({ createdAt: -1 }).limit(10)
      .populate('user', 'gamertag')
      .populate('raid', 'name');
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
    if (!['Locked', 'InProgress'].includes(raid.state)) {
      return res.status(400).json({ message: 'Solo puedes hacer checkout cuando la raid está Locked o InProgress' });
    }
    const assignment = raid.assignments.find(a => String(a.user) === String(req.user._id));
    if (!assignment) return res.status(404).json({ message: 'No estás asignado a esta raid' });
    if (assignment.attendance === 'Declined') {
      return res.status(400).json({ message: 'Ya habías hecho checkout en esta raid' });
    }

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
