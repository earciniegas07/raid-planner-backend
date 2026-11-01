const User = require('../models/User');

// Officer/Raid Leader primero, luego mayor nivel
const seniorityRank = (user) =>
  (user.role === 'Officer' || user.role === 'Raid Leader') ? 0 : 1;

async function assignRolesForRaid(raid) {
  const pool = await User.find({ clanId: raid.clanId, role: { $ne: 'Bench' } });
  const required = raid.requiredRoles instanceof Map
    ? raid.requiredRoles
    : new Map(Object.entries(raid.requiredRoles || {}));
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

module.exports = { assignRolesForRaid };
