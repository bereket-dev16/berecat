import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)

class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    void callback
  }

  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  })
}

declare module '@vitest/expect' {
  interface Assertion<T> {
    toBeInTheDocument(): T
    toHaveAttribute(name: string, value?: string): T
    toHaveTextContent(text: string | RegExp): T
    toHaveValue(value?: string | string[] | number | null): T
    toBeDisabled(): T
    toHaveFocus(): T
  }
}
