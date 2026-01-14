import Driver from '../models/Driver.js';

// Get all drivers
export const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

// Get single driver
export const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findByPk(id);
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Failed to fetch driver' });
  }
};

// Create new driver
export const createDriver = async (req, res) => {
  try {
    const { name, email, phone, license_number, license_expiration, status } = req.body;
    
    // Validation
    if (!name || !license_number) {
      return res.status(400).json({ error: 'Name and license number are required' });
    }

    // Check if license number already exists
    const existingDriver = await Driver.findOne({ where: { license_number } });
    if (existingDriver) {
      return res.status(400).json({ error: 'License number already exists' });
    }

    const driver = await Driver.create({
      name,
      email: email || null,
      phone: phone || null,
      license_number,
      license_expiration: license_expiration || null,
      status: status || 'active'
    });

    res.status(201).json({
      message: 'Driver created successfully',
      driver
    });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create driver',
      message: error.message || 'Failed to create driver'
    });
  }
};

// Update driver
export const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, license_number, license_expiration, status } = req.body;

    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if license number is being changed and if new license number already exists
    if (license_number && license_number !== driver.license_number) {
      const existingDriver = await Driver.findOne({ where: { license_number } });
      if (existingDriver) {
        return res.status(400).json({ error: 'License number already exists' });
      }
    }

    // Update fields
    if (name !== undefined) driver.name = name;
    if (email !== undefined) driver.email = email || null;
    if (phone !== undefined) driver.phone = phone || null;
    if (license_number !== undefined) driver.license_number = license_number;
    if (license_expiration !== undefined) driver.license_expiration = license_expiration || null;
    if (status !== undefined) driver.status = status;

    await driver.save();

    res.json({
      message: 'Driver updated successfully',
      driver
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to update driver',
      message: error.message || 'Failed to update driver'
    });
  }
};

// Delete driver
export const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;
    
    const driver = await Driver.findByPk(id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    await driver.destroy();

    res.json({
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to delete driver',
      message: error.message || 'Failed to delete driver'
    });
  }
};
