import express from 'express';
import { Op } from 'sequelize';
import { AuditLog, User } from '../models/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs (Super Administrator only)
router.get('/', authenticateToken, requireRole('super_administrator'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            action = '',
            entityType = '',
            startDate,
            endDate
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const whereClause = {};

        if (action) {
            whereClause.action = action;
        }

        if (entityType) {
            whereClause.entity_type = entityType;
        }

        if (startDate || endDate) {
            whereClause.created_at = {};
            if (startDate) {
                whereClause.created_at[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                // Set end date to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.created_at[Op.lte] = end;
            }
        }

        if (search) {
            whereClause[Op.or] = [
                { actor_name: { [Op.iLike]: `%${search}%` } },
                { entity_id: { [Op.iLike]: `%${search}%` } }, // Entity ID is a string now
                { ip_address: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows } = await AuditLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'Actor',
                    attributes: ['id', 'username', 'first_name', 'last_name', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        res.json({
            logs: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            error: 'Failed to fetch audit logs',
            message: error.message
        });
    }
});

export default router;
