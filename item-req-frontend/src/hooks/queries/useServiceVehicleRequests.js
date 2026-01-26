import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceVehicleRequestsAPI } from '../../services/api';
import { useContext } from 'react';
import { ToastContext } from '../../contexts/ToastContext';

// Key factory for cache keys
export const vehicleRequestKeys = {
    all: ['service-vehicle-requests'],
    lists: () => [...vehicleRequestKeys.all, 'list'],
    list: (filters) => [...vehicleRequestKeys.lists(), { ...filters }],
    details: () => [...vehicleRequestKeys.all, 'detail'],
    detail: (id) => [...vehicleRequestKeys.details(), id],
};

export function useServiceVehicleRequests(id = null) {
    const queryClient = useQueryClient();
    const { error: toastError, success: toastSuccess } = useContext(ToastContext);

    // FETCH LIST
    const useRequests = (filters = {}) => useQuery({
        queryKey: vehicleRequestKeys.list(filters),
        queryFn: async () => {
            const { data } = await serviceVehicleRequestsAPI.getAll(filters);
            return data;
        },
        // Keep data fresh for 1 minute, but cached for longer
        staleTime: 60 * 1000,
        // Only run if isEnabled is not false (handle outside control)
        enabled: filters.isEnabled !== false
    });

    // FETCH SINGLE REQUEST
    const useRequest = () => useQuery({
        queryKey: vehicleRequestKeys.detail(id),
        queryFn: async () => {
            if (!id) return null;
            const { data } = await serviceVehicleRequestsAPI.getById(id);
            // Ensure we return the 'request' object consistently
            return data.request || data;
        },
        enabled: !!id, // Only fetch if ID exists
    });

    // CREATE MUTATION
    const createRequest = useMutation({
        mutationFn: (newData) => serviceVehicleRequestsAPI.create(newData),
        onSuccess: (data) => {
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
            // Return data for the component to use (e.g. navigation)
            return data;
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to create request");
        }
    });

    // UPDATE MUTATION (Save Draft / Update)
    const updateRequest = useMutation({
        mutationFn: ({ id, data }) => serviceVehicleRequestsAPI.update(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(variables.id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to update request");
        }
    });

    // SUBMIT MUTATION
    const submitRequest = useMutation({
        mutationFn: (id) => serviceVehicleRequestsAPI.submit(id),
        onSuccess: (data, id) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to submit request");
        }
    });

    // APPROVE MUTATION
    const approveRequest = useMutation({
        mutationFn: ({ id, data }) => serviceVehicleRequestsAPI.approve(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(variables.id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to approve request");
        }
    });

    // DECLINE MUTATION
    const declineRequest = useMutation({
        mutationFn: ({ id, data }) => serviceVehicleRequestsAPI.decline(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(variables.id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to decline request");
        }
    });

    // RETURN MUTATION
    const returnRequest = useMutation({
        mutationFn: ({ id, data }) => serviceVehicleRequestsAPI.return(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(variables.id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to return request");
        }
    });

    // DELETE MUTATION
    const deleteRequest = useMutation({
        mutationFn: (id) => serviceVehicleRequestsAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to delete request");
        }
    });

    // ASSIGN VERIFIER MUTATION
    const assignVerifier = useMutation({
        mutationFn: ({ id, data }) => serviceVehicleRequestsAPI.assignVerifier(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(variables.id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to assign verifier");
        }
    });

    // VERIFY REQUEST MUTATION
    const verifyRequest = useMutation({
        mutationFn: ({ id, data }) => serviceVehicleRequestsAPI.verifyRequest(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(vehicleRequestKeys.detail(variables.id));
            queryClient.invalidateQueries(vehicleRequestKeys.lists());
        },
        onError: (err) => {
            toastError(err.response?.data?.message || "Failed to verify request");
        }
    });


    return {
        useRequests,
        useRequest,
        createRequest,
        updateRequest,
        submitRequest,
        approveRequest,
        declineRequest,
        returnRequest,
        deleteRequest,
        assignVerifier,
        verifyRequest
    };
}
