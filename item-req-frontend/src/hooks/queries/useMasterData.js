import { useQuery } from '@tanstack/react-query';
import { departmentsAPI, vehicleManagementApi, driverManagementApi } from '../../services/api';

export const masterDataKeys = {
    departments: ['departments'],
    vehicles: ['vehicles'],
    drivers: ['drivers'],
};

export function useMasterData() {

    const useDepartments = (active = true) => useQuery({
        queryKey: [...masterDataKeys.departments, { active }],
        queryFn: async () => {
            const { data } = await departmentsAPI.getAll({ active: active.toString() });
            return data.departments || data;
        },
        staleTime: 5 * 60 * 1000, // Departments don't change often, keep for 5 mins
    });

    const useVehicles = () => useQuery({
        queryKey: masterDataKeys.vehicles,
        queryFn: async () => {
            const { data } = await vehicleManagementApi.getAll();
            return data || [];
        },
        staleTime: 2 * 60 * 1000, // Vehicles relatively static
    });

    const useDrivers = () => useQuery({
        queryKey: masterDataKeys.drivers,
        queryFn: async () => {
            const { data } = await driverManagementApi.getAll();
            // Handle different response structures gracefully
            return data.drivers || data || [];
        },
        staleTime: 2 * 60 * 1000, // Drivers relatively static
    });

    return {
        useDepartments,
        useVehicles,
        useDrivers
    };
}
