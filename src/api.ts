import { Platform } from 'react-native';

export const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return ''; // Relative URLs for web
  }
  // In production, you would replace this with your actual backend URL:
  if (__DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  return 'https://api.mumantij-ai.com'; // Adjust to your actual domain
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = getApiUrl() + endpoint;
  
  // React Native fetch automatically handles cookies natively, 
  // so express-session will work out of the box in most setups.
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
  });
};
