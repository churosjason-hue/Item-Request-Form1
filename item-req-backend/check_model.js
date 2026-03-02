import { sequelize } from './config/database.js';
import ServiceVehicleRequest from './models/ServiceVehicleRequest.js';
import User from './models/User.js';

(async () => {
    try {
        const request = await ServiceVehicleRequest.findByPk(48);
        console.log(JSON.stringify(request.toJSON(), null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
