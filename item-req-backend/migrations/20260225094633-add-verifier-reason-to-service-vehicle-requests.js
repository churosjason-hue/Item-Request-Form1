'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('service_vehicle_requests', 'verifier_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for assigning the temporary verifier'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('service_vehicle_requests', 'verifier_reason');
  }
};
