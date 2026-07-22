import { describe, it, expect, beforeEach } from 'vitest'
import { loadPos, savePos, loadCollapsed, saveCollapsed, loadFloating, saveFloating, defaultPos, clampPos } from './persistence'

describe('miniplayer persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadPos returns null by default', () => {
    expect(loadPos()).toBeNull()
  })

  it('savePos and loadPos round-trip', () => {
    savePos({ x: 100, y: 200 })
    expect(loadPos()).toEqual({ x: 100, y: 200 })
  })

  it('savePos null removes key', () => {
    savePos({ x: 100, y: 200 })
    savePos(null)
    expect(loadPos()).toBeNull()
  })

  it('loadCollapsed returns false by default', () => {
    expect(loadCollapsed()).toBe(false)
  })

  it('saveCollapsed and loadCollapsed round-trip', () => {
    saveCollapsed(true)
    expect(loadCollapsed()).toBe(true)
    saveCollapsed(false)
    expect(loadCollapsed()).toBe(false)
  })

  it('loadFloating returns false by default', () => {
    expect(loadFloating()).toBe(false)
  })

  it('saveFloating and loadFloating round-trip', () => {
    saveFloating(true)
    expect(loadFloating()).toBe(true)
    saveFloating(false)
    expect(loadFloating()).toBe(false)
  })

  it('defaultPos returns object with x and y', () => {
    const pos = defaultPos()
    expect(pos).toHaveProperty('x')
    expect(pos).toHaveProperty('y')
    expect(typeof pos.x).toBe('number')
    expect(typeof pos.y).toBe('number')
  })

  it('clampPos clamps within viewport', () => {
    const clamped = clampPos({ x: -10, y: -10 }, 100, 64)
    expect(clamped.x).toBe(0)
    expect(clamped.y).toBe(0)
  })
})
