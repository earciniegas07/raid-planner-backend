// Datos de ejemplo para desarrollo y demo. Es idempotente: se puede correr varias veces.
// Uso: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Clan = require('./models/Clan');
const Raid = require('./models/Raid');
const Failure = require('./models/Failure');
const { assignRolesForRaid } = require('./utils/assignRoles');

const HOUR = 3600 * 1000;
const inHours = (h) => new Date(Date.now() + h * HOUR);

const CLANS = [
  { name: 'La Horda de Hierro', faction: 'Horde', description: 'Clan enfocado en raids míticas de alto nivel.' },
  { name: 'Alianza del Viento', faction: 'Alliance', description: 'Gremio casual PvE y raid táctica.' },
  { name: 'Mercenarios Neutros', faction: 'Neutral', description: 'Jugadores libres para contratar en raids de cualquier facción.' },
];

// [username, email, gamertag, class, region, level, role, reliability, clan]
const USERS = [
  ['admin', 'admin@raidplanner.com', 'TankCommander', 'Tank', 'SA', 100, 'Raid Leader', 100, 0],
  ['jugador', 'jugador@raidplanner.com', 'FireMage', 'DPS', 'SA', 99, 'Raider', 92, 0],
  ['ironshield', 'ironshield@raidplanner.com', 'IronShield', 'Tank', 'NA', 98, 'Officer', 95, 0],
  ['holypriest', 'holypriest@raidplanner.com', 'HolyPriest', 'Healer', 'SA', 95, 'Officer', 90, 0],
  ['mistweaver', 'mistweaver@raidplanner.com', 'MistWeaver', 'Healer', 'NA', 78, 'Bench', 65, 0],
  ['aegiswall', 'aegiswall@raidplanner.com', 'AegisWall', 'Tank', 'EU', 90, 'Raider', 85, 1],
  ['lifebloom', 'lifebloom@raidplanner.com', 'LifeBloom', 'Healer', 'NA', 92, 'Raider', 88, 1],
  ['shadowblade', 'shadowblade@raidplanner.com', 'ShadowBlade', 'DPS', 'NA', 91, 'Raider', 86, 1],
  ['buffmaster', 'buffmaster@raidplanner.com', 'BuffMaster', 'Support', 'NA', 94, 'Officer', 95, 1],
  ['divinelight', 'divinelight@raidplanner.com', 'DivineLight', 'Healer', 'SA', 85, 'Raider', 80, 2],
  ['frostsniper', 'frostsniper@raidplanner.com', 'FrostSniper', 'DPS', 'SA', 89, 'Bench', 60, 2],
  ['auraprovider', 'auraprovider@raidplanner.com', 'AuraProvider', 'Support', 'SA', 82, 'Raider', 75, 2],
];

// [name, difficulty, state, startOffsetHours, durationHours, min, max, clan, requiredRoles]
const RAIDS = [
  ['Naxxramas Core', 'Mythic', 'Planning', 48, 3, 4, 20, 0, { Tank: 1, Healer: 1, DPS: 1 }],
  ['Molten Caverns', 'Heroic', 'Planning', 72, 2, 3, 15, 0, { Tank: 1, Healer: 2 }],
  ['Ulduar Keep', 'Mythic', 'Locked', 24, 4, 4, 25, 0, { Tank: 2, Healer: 1, DPS: 1 }],
  ['Black Temple', 'Heroic', 'Locked', 30, 3, 3, 20, 1, { Tank: 1, Healer: 1, DPS: 1, Support: 1 }],
  ['Onyxia Lair', 'Normal', 'InProgress', -1, 2, 3, 15, 0, { Tank: 1, Healer: 1, DPS: 1 }],
  ['Sunwell Plateau', 'Mythic', 'Completed', -96, 4, 4, 25, 0, { Tank: 2, Healer: 2, DPS: 1 }],
];

const FAILURE_TYPES = ['Failed mechanic', 'Interrupted wrong target', 'Pulled early', 'Broke CC', 'Wrong positioning', 'AFK during pull'];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const password = await bcrypt.hash('Test1234', 10);

  const clans = [];
  for (const c of CLANS) {
    clans.push(await Clan.findOneAndUpdate({ name: c.name }, c, { upsert: true, returnDocument: 'after' }));
  }

  const users = [];
  for (const [username, email, gamertag, cls, region, level, role, reliability, clan] of USERS) {
    users.push(await User.findOneAndUpdate(
      { email },
      { username, email, password, gamertag, class: cls, region, level, role, reliability, clanId: clans[clan]._id },
      { upsert: true, returnDocument: 'after' }
    ));
  }

  const savedRaids = [];
  for (const [name, difficulty, state, offset, durationHours, minPlayers, maxPlayers, clan, requiredRoles] of RAIDS) {
    const old = await Raid.findOne({ name });
    if (old) {
      await Failure.deleteMany({ raid: old._id });
      await old.deleteOne();
    }
    const raid = new Raid({
      name, difficulty, state, startTime: inHours(offset), durationHours,
      minPlayers, maxPlayers, clanId: clans[clan]._id, requiredRoles,
    });
    if (state !== 'Planning') {
      raid.assignments = await assignRolesForRaid(raid);
      raid.assignments.forEach((a, i) => { if (i % 2 === 0 && state !== 'Completed') a.attendance = 'Confirmed'; });
    }
    await raid.save();
    savedRaids.push(raid);
  }

  // Fallos de ejemplo en la raid ya terminada y en la que está en curso
  const completed = savedRaids.find(r => r.state === 'Completed');
  const inProgress = savedRaids.find(r => r.state === 'InProgress');
  const failures = [];
  [completed, inProgress].forEach((raid) => {
    raid.assignments.filter(a => a.tacticalRole !== 'Bench').forEach((a, i) => {
      failures.push({ user: a.user, raid: raid._id, type: FAILURE_TYPES[i % FAILURE_TYPES.length], severity: [1, 3, 5][i % 3] });
    });
  });
  if (failures.length) await Failure.insertMany(failures);

  console.log(`Seed listo: ${clans.length} clanes, ${users.length} usuarios, ${savedRaids.length} raids, ${failures.length} fallos`);
  process.exit(0);
})().catch((err) => {
  console.error('Error en el seed:', err.message);
  process.exit(1);
});
