import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClickUpClient } from '../src/lib/clickup/client'
import { driveClient } from '../src/lib/drive/client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('integration boundaries', () => {
  it('does not attribute a shared ClickUp task to the list where it merely appears', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tasks: [{ id: 'owned', list: { id: '901613119887' } }, { id: 'shared', list: { id: '901613035012' } }],
      last_page: true,
    })))
    vi.stubGlobal('fetch', request)
    const tasks = await new ClickUpClient('test-token').listTasks('901613119887')
    expect(tasks.map(task => task.id)).toEqual(['owned'])
    expect(request.mock.calls[0][1].method).toBe('GET')
  })

  it('continues pagination after a page containing only shared tasks', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ id: 'shared', list: { id: 'foreign' } }], last_page: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ id: 'owned', list: { id: 'home' } }], last_page: true })))
    vi.stubGlobal('fetch', request)
    expect((await new ClickUpClient('test-token').listTasks('home')).map(task => task.id)).toEqual(['owned'])
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed Drive credentials without including their contents in the error', () => {
    const privateValue = 'postgresql://user:do-not-log-me@example.invalid/db'
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', privateValue)
    expect(() => driveClient()).toThrow('must contain a valid Google service-account JSON object')
    try { driveClient() } catch (error) { expect(String(error)).not.toContain('do-not-log-me') }
  })

  it('rejects JSON that is not a service account', () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"not":"credentials"}')
    expect(() => driveClient()).toThrow('must contain a valid Google service-account JSON object')
  })
})
