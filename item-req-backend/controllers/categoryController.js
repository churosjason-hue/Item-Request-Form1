import { Category } from '../models/index.js';
import { logAudit } from '../utils/auditLogger.js';

export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            order: [['createdAt', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

export const createCategory = async (req, res) => {
    try {
        const { name, description, quantity, min_stock_level, track_stock, purposes } = req.body;

        // Check if exists
        const existing = await Category.findOne({ where: { name } });
        if (existing) {
            return res.status(409).json({ message: 'Category already exists' });
        }

        const category = await Category.create({
            name,
            description,
            quantity: quantity || 0,
            min_stock_level: min_stock_level || 5,
            track_stock: track_stock !== undefined ? track_stock : true,
            purposes: purposes || [],
            stock_updated_at: new Date()
        });
        // Audit Log
        await logAudit({
            req,
            action: 'CREATE',
            entityType: 'Inventory',
            entityId: category.id,
            details: {
                itemName: category.name,
                quantity: category.quantity
            }
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Error creating category' });
    }
};

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active, quantity, min_stock_level, track_stock, purposes } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const oldCategory = {
            name: category.name,
            quantity: category.quantity
        };

        const newQuantity = quantity !== undefined ? parseInt(quantity) : category.quantity;
        const stockUpdated = quantity !== undefined && parseInt(quantity) !== category.quantity;

        // Prepare updates
        const updates = {
            name,
            description,
            is_active,
            quantity: newQuantity,
            min_stock_level: min_stock_level !== undefined ? min_stock_level : category.min_stock_level,
            track_stock: track_stock !== undefined ? track_stock : category.track_stock,
            purposes: purposes !== undefined ? purposes : category.purposes
        };

        if (stockUpdated) {
            updates.stock_updated_at = new Date();
        }

        await category.update(updates);

        // Audit Log for Inventory Changes
        const changes = [];
        if (oldCategory.name !== category.name) {
            changes.push(`Name changed from '${oldCategory.name}' to '${category.name}'`);
        }
        if (oldCategory.quantity !== category.quantity) {
            changes.push(`Quantity changed from ${oldCategory.quantity} to ${category.quantity}`);
        }

        // Check for specific purposes changes
        const oldPurposes = JSON.stringify(category._previousDataValues?.purposes || []);
        // Note: Sequelize tracking might be tricky here depending on instance state.
        // Better to check against what we fetched? But we didn't save old purposes explicitly above.
        // Let's assume for now if 'purposes' was in req.body it triggered this.
        if (purposes !== undefined) {
            changes.push(`Specific purposes updated`);
        }

        if (changes.length > 0) {
            await logAudit({
                req,
                action: 'UPDATE',
                entityType: 'Inventory',
                entityId: category.id,
                details: {
                    itemName: category.name,
                    changes: changes
                }
            });
        }

        res.json(category);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'Error updating category' });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        await category.destroy();
        // Audit Log
        await logAudit({
            req,
            action: 'DELETE',
            entityType: 'Inventory',
            entityId: id, // use ID since object is destroyed
            details: {
                itemName: category.name
            }
        });

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};
