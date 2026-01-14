import Vehicle from '../models/Vehicle.js';

// Get all vehicles
export const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

// Get single vehicle
export const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(vehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
};

// Create new vehicle
export const createVehicle = async (req, res) => {
  try {
    const { make, model, year, plate, seaters } = req.body;
    
    // Validation
    if (!make || !model || !year || !plate || !seaters) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if plate already exists
    const existingVehicle = await Vehicle.findOne({ where: { plate } });
    if (existingVehicle) {
      return res.status(400).json({ error: 'License plate already exists' });
    }

    const vehicle = await Vehicle.create({
      make,
      model,
      year: parseInt(year),
      plate,
      seaters: parseInt(seaters)
    });

    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

// Update vehicle
export const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { make, model, year, plate, seaters } = req.body;

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Check if new plate is unique (and different from current)
    if (plate && plate !== vehicle.plate) {
      const existingVehicle = await Vehicle.findOne({ where: { plate } });
      if (existingVehicle) {
        return res.status(400).json({ error: 'License plate already exists' });
      }
    }

    // Update vehicle
    await vehicle.update({
      make: make || vehicle.make,
      model: model || vehicle.model,
      year: year ? parseInt(year) : vehicle.year,
      plate: plate || vehicle.plate,
      seaters: seaters ? parseInt(seaters) : vehicle.seaters
    });

    res.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

// Delete vehicle
export const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await vehicle.destroy();
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};

