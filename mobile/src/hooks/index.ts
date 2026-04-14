import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService, userService } from '../services';
import { useAuthStore } from '../stores';

// Hook para obtener el usuario actual
export const useCurrentUser = () => {
  const { token, isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(token!),
    enabled: isAuthenticated && !!token,
  });
};

// Hook para iniciar sesión
export const useLogin = () => {
  const queryClient = useQueryClient();
  const { login, setLoading } = useAuthStore();

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      const accessToken = data.tokens?.accessToken ?? data.token;
      login(data.user, accessToken);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
    onError: () => {
      setLoading(false);
    },
  });
};

// Hook para registrar usuario
export const useRegister = () => {
  const queryClient = useQueryClient();
  const { login, setLoading } = useAuthStore();

  return useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      const accessToken = data.tokens?.accessToken ?? data.token;
      login(data.user, accessToken);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
    onError: () => {
      setLoading(false);
    },
  });
};

// Hook para obtener categorías
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: userService.getCategories,
  });
};
