import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)

declare module '@vitest/expect' {
  interface Assertion<T> {
    toBeInTheDocument(): T
    toHaveAttribute(name: string, value?: string): T
    toHaveTextContent(text: string | RegExp): T
  }
}
