const express = require('express');
const { getRaids, createRaid, changeRaidState, addFailure, getRankings, checkIn, checkOut } = require('../controllers/raidController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * @swagger
 * /api/raids:
 *   get:
 *     summary: Lista todas las raids
 *     tags: [Raids]
 *     responses:
 *       200:
 *         description: Lista de raids con sus asignaciones
 *   post:
 *     summary: Crea una raid nueva (estado inicial Planning)
 *     tags: [Raids]
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
 *               difficulty: { type: string }
 *               startTime: { type: string, format: date-time }
 *               durationHours: { type: number }
 *               clanId: { type: string }
 *               requiredRoles: { type: object }
 *     responses:
 *       201:
 *         description: Raid creada
 */
router.route('/').get(getRaids).post(protect, createRaid);

/**
 * @swagger
 * /api/raids/{id}/state:
 *   patch:
 *     summary: Cambia el estado de la raid (Planning→Locked→InProgress→Completed/Failed)
 *     tags: [Raids]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newState: { type: string, enum: [Locked, InProgress, Completed, Failed] }
 *     responses:
 *       200:
 *         description: Raid actualizada
 *       403:
 *         description: No tienes el rango necesario para esta transición
 */
router.patch('/:id/state', protect, changeRaidState);

/**
 * @swagger
 * /api/raids/{id}/failures:
 *   post:
 *     summary: Registra un fallo de un jugador en esa raid (fallómetro)
 *     tags: [Raids]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               type: { type: string }
 *               severity: { type: number, enum: [1, 3, 5] }
 *     responses:
 *       201:
 *         description: Fallo registrado
 */
router.post('/:id/failures', protect, addFailure);

/**
 * @swagger
 * /api/raids/{id}/checkin:
 *   patch:
 *     summary: El jugador confirma asistencia a una raid Locked o InProgress
 *     tags: [Raids]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Check-in registrado
 *       404:
 *         description: No estás asignado a esta raid
 */
router.patch('/:id/checkin', protect, checkIn);

/**
 * @swagger
 * /api/raids/{id}/checkout:
 *   patch:
 *     summary: El jugador avisa que no va a poder asistir
 *     tags: [Raids]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Checkout registrado
 */
router.patch('/:id/checkout', protect, checkOut);

/**
 * @swagger
 * /api/raids/rankings/all:
 *   get:
 *     summary: Ranking general de fiabilidad y últimos fallos
 *     tags: [Raids]
 *     responses:
 *       200:
 *         description: Ranking de usuarios y fallos recientes
 */
router.get('/rankings/all', getRankings);

module.exports = router;