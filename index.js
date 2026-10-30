const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/authRoutes');
const raidRoutes = require('./routes/raidRoutes');
const clanRoutes = require('./routes/clanRoutes');
const userRoutes = require('./routes/userRoutes');

const { MONGO_URI, JWT_SECRET, FRONTEND_URL } = process.env;
if (!MONGO_URI || !JWT_SECRET) {
  console.error('Faltan MONGO_URI o JWT_SECRET en las variables de entorno');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors({ origin: FRONTEND_URL ? FRONTEND_URL.split(',') : '*' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/raids', raidRoutes);
app.use('/api/clans', clanRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => res.send('Servidor de RaidPlanner funcionando correctamente'));

const PORT = process.env.PORT || 5000;
mongoose.connect(MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`)))
  .catch(err => {
    console.error('Error al conectar a MongoDB:', err.message);
    process.exit(1);
  });