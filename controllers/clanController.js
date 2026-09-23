const Clan = require('../models/Clan');
const User = require('../models/User');

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

// Une al usuario logueado a un clan, respetando roleLimits si existen
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

module.exports = { getClans, createClan, joinClan };