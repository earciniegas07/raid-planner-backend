const express = require('express');
const { getUsers } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lista todos los jugadores
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios sin contraseña
 *       401:
 *         description: No autorizado
 */

router.get('/', protect, getUsers);
module.exports = router;