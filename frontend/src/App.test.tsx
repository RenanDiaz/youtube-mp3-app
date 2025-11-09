import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders YouTube to Audio Downloader heading', () => {
    render(<App />)
    const headingElement = screen.getByText(/YouTube to Audio Downloader/i)
    expect(headingElement).toBeInTheDocument()
  })

  it('renders tabs', () => {
    render(<App />)
    expect(screen.getByText('Single File')).toBeInTheDocument()
    expect(screen.getByText('Playlist')).toBeInTheDocument()
    expect(screen.getByText('Multi File')).toBeInTheDocument()
  })
})
