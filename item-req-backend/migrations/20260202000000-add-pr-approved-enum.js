
const { sequelize } = require('../models');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add 'pr_approved' to enum
        return queryInterface.sequelize.query("ALTER TYPE \"enum_requests_status\" ADD VALUE 'pr_approved';")
            .catch(err => {
                // Ignore if already exists (postgres throws error if adding existing value)
                if (!err.message.includes('already exists')) {
                    throw err;
                }
            });
    },

    down: async (queryInterface, Sequelize) => {
        // Enum removal is not trivial in postgres, usually ignored in down migrations for enums
    }
};
