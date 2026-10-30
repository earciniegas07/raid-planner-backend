module.exports = (res, error) => {
  const duplicate = error.code === 11000;
  const bad = duplicate || error.name === 'ValidationError' || error.name === 'CastError';
  res.status(bad ? 400 : 500).json({
    message: duplicate ? 'Ya existe un registro con ese valor único' : error.message,
  });
};