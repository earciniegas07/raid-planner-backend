const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const handleError = require('../utils/handleError');

const publicUser = (u) => ({
  id: u._id, username: u.username, email: u.email, gamertag: u.gamertag,
  class: u.class, region: u.region, level: u.level, role: u.role,
  reliability: u.reliability, clanId: u.clanId,
});

exports.register = async (req, res) => {
  try {
    const { username, email, password, gamertag, class: userClass, region, level } = req.body;
    if (!username || !email || !password || !gamertag || !userClass) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'El usuario o email ya existe' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username, email, password: hashed, gamertag, class: userClass, region, level,
    });
    res.status(201).json({ message: 'Usuario registrado', token: generateToken(user._id), user: publicUser(user) });
  } catch (error) {
    handleError(res, error);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }
    res.json({ message: 'Inicio de sesión exitoso', token: generateToken(user._id), user: publicUser(user) });
  } catch (error) {
    handleError(res, error);
  }
};

exports.me = (req, res) => res.json(publicUser(req.user));