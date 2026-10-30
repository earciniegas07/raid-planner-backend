require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Clan = require('./models/Clan');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const clan = await Clan.findOneAndUpdate(
    { name: 'La Horda de Hierro' },
    { faction: 'Horde', description: 'Clan enfocado en raids míticas de alto nivel.' },
    { upsert: true, new: true }
  );

  const password = await bcrypt.hash('Test1234', 10);
  const users = [
    { username: 'admin', email: 'admin@raidplanner.com', gamertag: 'TankCommander', class: 'Tank', role: 'Raid Leader', level: 100 },
    { username: 'jugador', email: 'jugador@raidplanner.com', gamertag: 'FireMage', class: 'DPS', role: 'Raider', level: 90 },
  ];
  for (const u of users) {
    await User.findOneAndUpdate({ email: u.email }, { ...u, password, clanId: clan._id }, { upsert: true, returnDocument: 'after' });
  }
  console.log('Seed listo');
  process.exit(0);
})();