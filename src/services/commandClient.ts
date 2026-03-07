import { apiClient } from './apiClient';

export const invoke = apiClient.invoke.bind(apiClient);
