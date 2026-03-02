import { SystemSetting } from '../models/index.js';
import { logAudit } from '../utils/auditLogger.js';

// Get setting by key
export const getSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await SystemSetting.findByPk(key);

        if (!setting) {
            // Return default false/null if not set
            return res.json({ key, value: null });
        }

        // Parse JSON if it looks like JSON/boolean, otherwise return string
        let parsedValue = setting.value;
        try {
            parsedValue = JSON.parse(setting.value);
        } catch (e) {
            // Value is a simple string
        }

        res.json({ key: setting.key, value: parsedValue });
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
};

// Update setting
export const updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        // Verify permissions (Admins only)
        if (req.user.role !== 'super_administrator' && req.user.role !== 'it_manager' && req.user.role !== 'service_desk') {
            return res.status(403).json({ error: 'Access denied' });
        }

        let valueToStore = value;
        if (typeof value === 'object' || typeof value === 'boolean') {
            valueToStore = JSON.stringify(value);
        }

        const [setting, created] = await SystemSetting.findOrCreate({
            where: { key },
            defaults: { value: valueToStore }
        });

        if (!created) {
            await setting.update({ value: valueToStore });
        }

        // Audit Log
        const logAction = created ? 'CREATE_SETTING' : 'UPDATE_SETTING';
        await logAudit({
            req,
            action: 'UPDATE', // Use standard UPDATE action, clarify in details
            entityType: 'SystemSetting',
            entityId: key,
            details: {
                settingKey: key,
                newValue: typeof value === 'object' ? JSON.stringify(value) : value,
                isNew: created
            }
        });

        res.json({ message: 'Setting updated successfully', key, value });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
};

// Get general purposes helper
export const getGeneralPurposes = async (req, res) => {
    try {
        const setting = await SystemSetting.findByPk('general_purposes');

        let purposes = [];
        if (setting && setting.value) {
            try {
                purposes = JSON.parse(setting.value);
            } catch (e) {
                // If storing simple strings or failed parse
                purposes = [];
            }
        }

        res.json(purposes);
    } catch (error) {
        console.error('Error fetching general purposes:', error);
        res.status(500).json({ error: 'Failed to fetch general purposes' });
    }
};
