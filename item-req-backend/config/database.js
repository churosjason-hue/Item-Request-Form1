import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'it_equipment_requests',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Dean0522',
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 20, // Increased max connections
    min: 2, // Keep at least 2 connections open
    acquire: 60000, // Increase acquire timeout to 60s
    idle: 30000 // Increase idle timeout to 30s
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

export { sequelize };
