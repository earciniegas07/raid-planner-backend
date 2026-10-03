const express = require('express');
const { getClans, createClan, joinClan, getClanRankings } = require('../controllers/clanController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * @swagger
 * /api/clans:
 *   get:
 *     summary: Lista todos los clanes
 *     tags: [Clanes]
 *     responses:
 *       200:
 *         description: Lista de clanes
 *   post:
 *     summary: Crea un clan nuevo
 *     tags: [Clanes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               faction: { type: string, enum: [Horde, Alliance, Neutral] }
 *               description: { type: string }
 *               banner: { type: string }
 *               roleLimits:
 *                 type: object
 *                 properties:
 *                   Tank: { type: number }
 *                   Healer: { type: number }
 *                   DPS: { type: number }
 *                   Support: { type: number }
 *     responses:
 *       201:
 *         description: Clan creado
 */
router.route('/').get(getClans).post(protect, createClan);

/**
 * @swagger
 * /api/clans/{id}/join:
 *   post:
 *     summary: El usuario logueado se une a un clan (respeta roleLimits si existen)
 *     tags: [Clanes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usuario unido al clan
 *       400:
 *         description: Cupo lleno para esa clase en el clan
 *       404:
 *         description: Clan no encontrado
 */
router.post('/:id/join', protect, joinClan);

/**
 * @swagger
 * /api/clans/{id}/rankings:
 *   get:
 *     summary: Rankings del clan — Hard Carry, Bench Warmer y Mechanics Pro
 *     tags: [Clanes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Los tres rankings del clan
 *       404:
 *         description: Clan no encontrado
 */
router.get('/:id/rankings', getClanRankings);

module.exports = router;