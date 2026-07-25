// Jest setup file for configuring testing environment
import '@testing-library/jest-dom';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Loader2: () => 'Loader2',
  Send: () => 'Send',
  AlertCircle: () => 'AlertCircle',
}));
