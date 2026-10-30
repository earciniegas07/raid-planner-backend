const User = require('../models/User');
const handleError = require('../utils/handleError');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('clanId', 'name');
    res.json(users);
  } catch (error) {
    handleError(res, error);
  }
};