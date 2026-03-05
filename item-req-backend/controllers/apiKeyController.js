import crypto from 'crypto';
import { ApiKey, User } from '../models/index.js';

// Generate a secure random API key
function generateRawKey() {
    const randomBytes = crypto.randomBytes(30).toString('hex'); // 60 hex chars
    return `prism_live_${randomBytes}`;
}

// Hash a raw key with SHA-256
function hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// POST /api/api-keys — Create a new API key
export const createApiKey = async (req, res) => {
    try {
        const { name, expires_at } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Key name is required' });
        }

        const rawKey = generateRawKey();
        const keyHash = hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, 20); // e.g. "prism_live_a1b2c3d4e5"

        const apiKey = await ApiKey.create({
            name: name.trim(),
            key_hash: keyHash,
            key_prefix: keyPrefix,
            created_by: req.user.id,
            is_active: true,
            expires_at: expires_at || null
        });

        // Return the plain key ONCE — it will never be available again
        return res.status(201).json({
            success: true,
            message: 'API key created. Copy the key now — it will not be shown again.',
            key: rawKey, // plain text — only returned on creation
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                key_prefix: apiKey.key_prefix,
                is_active: apiKey.is_active,
                expires_at: apiKey.expires_at,
                created_at: apiKey.created_at
            }
        });
    } catch (error) {
        console.error('Error creating API key:', error);
        return res.status(500).json({ error: 'Failed to create API key', message: error.message });
    }
};

// GET /api/api-keys — List all API keys (no plain key, no hash)
export const listApiKeys = async (req, res) => {
    try {
        const keys = await ApiKey.findAll({
            include: [{
                model: User,
                as: 'CreatedBy',
                attributes: ['id', 'first_name', 'last_name', 'username']
            }],
            order: [['created_at', 'DESC']]
        });

        const safeKeys = keys.map(k => ({
            id: k.id,
            name: k.name,
            key_prefix: k.key_prefix,
            is_active: k.is_active,
            last_used_at: k.last_used_at,
            expires_at: k.expires_at,
            created_at: k.created_at,
            created_by: k.CreatedBy ? {
                id: k.CreatedBy.id,
                name: `${k.CreatedBy.first_name} ${k.CreatedBy.last_name}`,
                username: k.CreatedBy.username
            } : null
        }));

        return res.json({ success: true, keys: safeKeys });
    } catch (error) {
        console.error('Error listing API keys:', error);
        return res.status(500).json({ error: 'Failed to list API keys', message: error.message });
    }
};

// PATCH /api/api-keys/:id/revoke — Revoke (deactivate) an API key
export const revokeApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        const apiKey = await ApiKey.findByPk(id);

        if (!apiKey) {
            return res.status(404).json({ error: 'API key not found' });
        }

        if (!apiKey.is_active) {
            return res.status(400).json({ error: 'API key is already revoked' });
        }

        await apiKey.update({ is_active: false });

        return res.json({ success: true, message: 'API key revoked successfully' });
    } catch (error) {
        console.error('Error revoking API key:', error);
        return res.status(500).json({ error: 'Failed to revoke API key', message: error.message });
    }
};

// DELETE /api/api-keys/:id — Permanently delete an API key
export const deleteApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        const apiKey = await ApiKey.findByPk(id);

        if (!apiKey) {
            return res.status(404).json({ error: 'API key not found' });
        }

        await apiKey.destroy();

        return res.json({ success: true, message: 'API key deleted permanently' });
    } catch (error) {
        console.error('Error deleting API key:', error);
        return res.status(500).json({ error: 'Failed to delete API key', message: error.message });
    }
};
