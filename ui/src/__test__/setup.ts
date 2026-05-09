import '@testing-library/jest-dom'

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

class MockResizeObserver {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback([
      {
        borderBoxSize: [],
        contentBoxSize: [],
        contentRect: {
          bottom: 768,
          height: 768,
          left: 0,
          right: 1024,
          toJSON: () => ({}),
          top: 0,
          width: 1024,
          x: 0,
          y: 0,
        },
        devicePixelContentBoxSize: [],
        target,
      },
    ], this)
  }

  disconnect() {
    return null
  }

  unobserve() {
    return null
  }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  configurable: true,
  value: MockIntersectionObserver,
  writable: true,
})

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: MockResizeObserver,
  writable: true,
})
