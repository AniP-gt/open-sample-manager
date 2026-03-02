import '@testing-library/jest-dom'

// Polyfill IntersectionObserver for tests
class MockIntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

(globalThis as any).IntersectionObserver = MockIntersectionObserver
