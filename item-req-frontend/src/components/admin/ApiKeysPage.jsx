import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, ShieldOff, Copy, Check, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ApiKeysPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyExpiry, setNewKeyExpiry] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [revealedKey, setRevealedKey] = useState(null); // { key, name }
    const [copiedId, setCopiedId] = useState(null);
    const [error, setError] = useState('');

    // Guard: only super_admin
    useEffect(() => {
        if (user && user.role !== 'super_administrator') {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const fetchKeys = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api-keys');
            setKeys(res.data.keys || []);
        } catch (err) {
            setError('Failed to load API keys.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchKeys(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;
        setCreating(true);
        setError('');
        try {
            const res = await api.post('/api-keys', {
                name: newKeyName.trim(),
                expires_at: newKeyExpiry || null
            });
            setRevealedKey({ key: res.data.key, name: newKeyName.trim() });
            setNewKeyName('');
            setNewKeyExpiry('');
            setShowCreateForm(false);
            await fetchKeys();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create API key.');
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id, name) => {
        if (!window.confirm(`Revoke API key "${name}"? It will stop working immediately.`)) return;
        try {
            await api.patch(`/api-keys/${id}/revoke`);
            await fetchKeys();
        } catch (err) {
            setError('Failed to revoke key.');
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Permanently delete API key "${name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/api-keys/${id}`);
            await fetchKeys();
        } catch (err) {
            setError('Failed to delete key.');
        }
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl">
                            <Key className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Manage API keys for external system integrations
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        New Key
                    </button>
                </div>

                {/* One-Time Key Reveal Banner */}
                {revealedKey && (
                    <div className="mb-6 p-5 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 rounded-xl">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                                    ⚠️ Copy this key now — it will never be shown again
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                                    API Key for: <strong>{revealedKey.name}</strong>
                                </p>
                                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                                    <code className="flex-1 text-sm font-mono text-gray-800 dark:text-gray-200 break-all select-all">
                                        {revealedKey.key}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(revealedKey.key, 'reveal')}
                                        className="flex-shrink-0 p-1.5 text-amber-600 hover:text-amber-800 transition-colors"
                                        title="Copy key"
                                    >
                                        {copiedId === 'reveal' ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setRevealedKey(null)}
                            className="mt-3 text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline"
                        >
                            I've saved it — dismiss
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Create Form Modal */}
                {showCreateForm && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create New API Key</h2>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Key Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={e => setNewKeyName(e.target.value)}
                                        placeholder="e.g. OEE Dashboard Integration"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Expiry Date <span className="text-gray-400">(optional)</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={newKeyExpiry}
                                        onChange={e => setNewKeyExpiry(e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Leave blank for a key that never expires.</p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowCreateForm(false); setNewKeyName(''); setNewKeyExpiry(''); }}
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creating || !newKeyName.trim()}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                    >
                                        {creating ? 'Creating...' : 'Create Key'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Keys List */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                            {keys.length} API Key{keys.length !== 1 ? 's' : ''}
                        </h2>
                        <button
                            onClick={fetchKeys}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                    ) : keys.length === 0 ? (
                        <div className="text-center py-16">
                            <Key className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No API keys yet.</p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Create one to allow external systems to access the PRISM API.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {keys.map(k => {
                                const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
                                const statusColor = !k.is_active
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                    : isExpired
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
                                const statusLabel = !k.is_active ? 'Revoked' : isExpired ? 'Expired' : 'Active';

                                return (
                                    <div key={k.id} className="px-6 py-4 flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${k.is_active && !isExpired ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                            <Key className={`h-4 w-4 ${k.is_active && !isExpired ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-medium text-gray-900 dark:text-white text-sm truncate">{k.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                                <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                                    {k.key_prefix}…
                                                </code>
                                                <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                                                {k.last_used_at && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        Used {new Date(k.last_used_at).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {k.expires_at && (
                                                    <span>Expires {new Date(k.expires_at).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                            {k.created_by && (
                                                <p className="text-xs text-gray-400 mt-0.5">by {k.created_by.name}</p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            {k.is_active && !isExpired && (
                                                <button
                                                    onClick={() => handleRevoke(k.id, k.name)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors font-medium"
                                                    title="Revoke key"
                                                >
                                                    <ShieldOff className="h-3.5 w-3.5" />
                                                    Revoke
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(k.id, k.name)}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                title="Delete permanently"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Usage Guide */}
                <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-2">How to use an API Key</h3>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
                        Include the key as an <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded font-mono">X-API-Key</code> header in every request:
                    </p>
                    <div className="bg-gray-900 rounded-lg p-3 relative">
                        <code className="text-green-400 text-xs font-mono whitespace-pre">
                            {`curl -H "X-API-Key: prism_live_your_key_here" \\
     https://your-server/api/requests`}
                        </code>
                        <button
                            onClick={() => handleCopy('curl -H "X-API-Key: prism_live_your_key_here" \\\n     https://your-server/api/requests', 'example')}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white"
                        >
                            {copiedId === 'example' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-500 mt-3">
                        ⚠️ API keys have <strong>super administrator</strong> access. Share only with trusted internal systems.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ApiKeysPage;
