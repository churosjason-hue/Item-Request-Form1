import { Item } from '../models/index.js';
import { Op } from 'sequelize';
import { logAudit, calculateChanges } from '../utils/auditLogger.js';

export const getAllItems = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            category = '',
            sortBy = 'name',
            sortOrder = 'ASC'
        } = req.query;

        const offset = (page - 1) * limit;

        // Build where clause
        const where = {};

        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        if (status) {
            where.status = status;
        }

        if (category) {
            where.category = category;
        }

        // Handle sorting
        const order = [[sortBy, sortOrder.toUpperCase()]];

        const items = await Item.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order
        });

        res.json({
            items: items.rows,
            totalPages: Math.ceil(items.count / limit),
            currentPage: parseInt(page),
            totalItems: items.count
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ message: 'Error fetching items', error: error.message });
    }
};

export const getItemById = async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ message: 'Error fetching item', error: error.message });
    }
};

export const createItem = async (req, res) => {
    try {
        const item = await Item.create(req.body);

        await logAudit({
            req,
            action: 'CREATE',
            entityType: 'Item',
            entityId: item.id,
            details: {
                name: item.name,
                description: item.description,
                category: item.category
            }
        });

        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ message: 'Error creating item', error: error.message });
    }
};

export const updateItem = async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const oldData = item.toJSON();
        await item.update(req.body);
        const newData = item.toJSON();

        const changes = calculateChanges(oldData, newData);

        if (Object.keys(changes).length > 0) {
            await logAudit({
                req,
                action: 'UPDATE',
                entityType: 'Item',
                entityId: item.id,
                details: {
                    changes,
                    itemName: item.name
                }
            });
        }

        res.json(item);
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ message: 'Error updating item', error: error.message });
    }
};

export const deleteItem = async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const itemDetails = {
            name: item.name,
            category: item.category
        };

        await item.destroy();

        await logAudit({
            req,
            action: 'DELETE',
            entityType: 'Item',
            entityId: req.params.id,
            details: itemDetails
        });

        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ message: 'Error deleting item', error: error.message });
    }
};
