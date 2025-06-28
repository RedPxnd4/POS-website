import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isLoading: true,
  isAuthenticated: false,
  requiresTwoFactor: false
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        requiresTwoFactor: false
      };
    
    case 'REQUIRE_TWO_FACTOR':
      return {
        ...state,
        requiresTwoFactor: true,
        isLoading: false
      };
    
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
        token: null,
        refreshToken: null
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    
    case 'REFRESH_TOKEN':
      return {
        ...state,
        token: action.payload.accessToken
      };
    
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!token || !refreshToken) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        // Try to refresh token to validate session
        const response = await authAPI.refreshToken(refreshToken);
        
        // Update token in localStorage
        localStorage.setItem('token', response.data.accessToken);
        
        dispatch({
          type: 'REFRESH_TOKEN',
          payload: { accessToken: response.data.accessToken }
        });
        
        // Get user profile
        const userResponse = await authAPI.getProfile();
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: userResponse.data.user,
            accessToken: response.data.accessToken,
            refreshToken: refreshToken
          }
        });
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        dispatch({ type: 'LOGOUT' });
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authAPI.login(credentials);
      
      if (response.data.requiresTwoFactor) {
        dispatch({ type: 'REQUIRE_TWO_FACTOR' });
        return { requiresTwoFactor: true };
      }
      
      // Store tokens
      localStorage.setItem('token', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response.data
      });
      
      return { success: true };
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const loginWithTwoFactor = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authAPI.login(credentials);
      
      // Store tokens
      localStorage.setItem('token', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response.data
      });
      
      return { success: true };
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await authAPI.logout({ refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(state.user.id, profileData);
      dispatch({
        type: 'UPDATE_USER',
        payload: response.data.user
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (passwordData) => {
    try {
      const response = await authAPI.changePassword(passwordData);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const setupTwoFactor = async () => {
    try {
      const response = await authAPI.setupTwoFactor();
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const verifyTwoFactor = async (token) => {
    try {
      const response = await authAPI.verifyTwoFactor({ token });
      dispatch({
        type: 'UPDATE_USER',
        payload: { twoFactorEnabled: true }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const disableTwoFactor = async (token, password) => {
    try {
      const response = await authAPI.disableTwoFactor({ token, password });
      dispatch({
        type: 'UPDATE_USER',
        payload: { twoFactorEnabled: false }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Check if user has required role
  const hasRole = (requiredRole) => {
    if (!state.user) return false;
    
    const roleHierarchy = {
      'staff': 1,
      'manager': 2,
      'admin': 3
    };
    
    const userLevel = roleHierarchy[state.user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  };

  const value = {
    ...state,
    login,
    loginWithTwoFactor,
    logout,
    updateProfile,
    changePassword,
    setupTwoFactor,
    verifyTwoFactor,
    disableTwoFactor,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};