import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the app heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /YouTube Audio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Convert YouTube to Audio/i })).toBeInTheDocument()
  })

  it('renders tabs', () => {
    render(<App />)
    expect(screen.getByText('Single File')).toBeInTheDocument()
    expect(screen.getByText('Playlist')).toBeInTheDocument()
    expect(screen.getByText('Multi File')).toBeInTheDocument()
  })

  describe('initial tab from URL (PWA shortcuts)', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/')
    })

    it('opens the tab requested by ?view=', () => {
      window.history.replaceState({}, '', '/?view=playlist')
      render(<App />)
      expect(screen.getByText('Playlist').closest('a')).toHaveClass('active')
      expect(screen.getByText('Single File').closest('a')).not.toHaveClass('active')
    })

    it('falls back to Single File for an unknown view', () => {
      window.history.replaceState({}, '', '/?view=nope')
      render(<App />)
      expect(screen.getByText('Single File').closest('a')).toHaveClass('active')
    })
  })
})
