const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(express.json());
app.use(cors());

// Rutas
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Servidor de RaidPlanner funcionando correctamente 🚀');
});

// Conexión a MongoDB Atlas
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ericwball82_db_user:XgLSAaBFZQvVcm8p@cluster0.rtzvqvf.mongodb.net/raidplanner?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas con éxito');
    app.listen(PORT, () => console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`));
  })
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));