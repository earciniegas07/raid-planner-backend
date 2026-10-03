const Clan = require('../models/Clan');
const User = require('../models/User');
const Raid = require('../models/Raid');
const Failure = require('../models/Failure');

const getClans = async (req, res) => {
  try {
    const clans = await Clan.find();
    res.json(clans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createClan = async (req, res) => {
  const { name, faction, description, banner, roleLimits } = req.body;
  try {
    const clan = await Clan.create({ name, faction, description, banner, roleLimits });
    res.status(201).json(clan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const joinClan = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ message: 'Clan no encontrado' });

    const limit = clan.roleLimits?.[req.user.class];
    if (limit != null) {
      const current = await User.countDocuments({ clanId: clan._id, class: req.user.class });
      if (current >= limit) {
        return res.status(400).json({ message: `Cupo lleno para ${req.user.class} en este clan` });
      }
    }

    req.user.clanId = clan._id;
    await req.user.save();
    res.json({ message: 'Te uniste al clan', user: req.user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hard Carry / Bench Warmer / Mechanics Pro, calculados sobre un clan específico
const getClanRankings = async (req, res) => {
  try {
    const clanId = req.params.id;
    const clan = await Clan.findById(clanId);
    if (!clan) return res.status(404).json({ message: 'Clan no encontrado' });

    const users = await User.find({ clanId });
    const raids = await Raid.find({ clanId });

    // Hard Carry: mayor reliability del clan
    const hardCarry = [...users]
      .sort((a, b) => b.reliability - a.reliability)
      .slice(0, 5);

    // Bench Warmer: más veces en Bench o con checkout/Declined en raids del clan
    const benchCount = {};
    raids.forEach(raid => {
      raid.assignments.forEach(a => {
        if (a.tacticalRole === 'Bench' || a.attendance === 'Declined') {
          const id = String(a.user);
          benchCount[id] = (benchCount[id] || 0) + 1;
        }
      });
    });
    const benchWarmer = users
      .map(u => ({ user: u, benchCount: benchCount[String(u._id)] || 0 }))
      .filter(entry => entry.benchCount > 0)
      .sort((a, b) => b.benchCount - a.benchCount)
      .slice(0, 5);

    // Mechanics Pro: menor proporción de fallos severidad 5 por raid jugada
    const raidIds = raids.map(r => r._id);
    const severeFailures = await Failure.find({ raid: { $in: raidIds }, severity: 5 });
    const severeCount = {};
    severeFailures.forEach(f => {
      const id = String(f.user);
      severeCount[id] = (severeCount[id] || 0) + 1;
    });

    const playedCount = {};
    raids.forEach(raid => {
      raid.assignments.forEach(a => {
        if (a.tacticalRole !== 'Bench') {
          const id = String(a.user);
          playedCount[id] = (playedCount[id] || 0) + 1;
        }
      });
    });

    const mechanicsPro = users
      .filter(u => (playedCount[String(u._id)] || 0) > 0)
      .map(u => {
        const played = playedCount[String(u._id)];
        const severe = severeCount[String(u._id)] || 0;
        return { user: u, played, severeFailures: severe, ratio: severe / played };
      })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);

    res.json({ hardCarry, benchWarmer, mechanicsPro });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getClans, createClan, joinClan, getClanRankings };