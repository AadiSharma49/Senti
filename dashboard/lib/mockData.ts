/**
 * Placeholder data for the dashboard shell. Replaced by the accounts /
 * devices API once the backend lands.
 */

export interface Device {
  id: string
  name: string
  os: string
  status: 'online' | 'locked' | 'offline'
  lastSeen: string
  voiceEnrolled: boolean
}

export interface ActivityEvent {
  id: string
  device: string
  type: 'voice_unlock' | 'pin_unlock' | 'voice_rejected' | 'lockout' | 'enrolled'
  when: string
  detail: string
}

export const devices: Device[] = [
  { id: 'd1', name: 'Aaditya-PC', os: 'Windows 11', status: 'locked', lastSeen: '2 min ago', voiceEnrolled: true },
  { id: 'd2', name: 'Studio-Desktop', os: 'Windows 10', status: 'online', lastSeen: 'just now', voiceEnrolled: true },
  { id: 'd3', name: 'Old-Laptop', os: 'Windows 11', status: 'offline', lastSeen: '3 days ago', voiceEnrolled: false },
]

export const activity: ActivityEvent[] = [
  { id: 'a1', device: 'Aaditya-PC', type: 'voice_unlock', when: '2 min ago', detail: 'Unlocked by voice · score 0.81' },
  { id: 'a2', device: 'Studio-Desktop', type: 'voice_unlock', when: '1 hr ago', detail: 'Unlocked by voice · score 0.77' },
  { id: 'a3', device: 'Aaditya-PC', type: 'voice_rejected', when: '3 hrs ago', detail: 'Voice not recognized · score 0.31' },
  { id: 'a4', device: 'Aaditya-PC', type: 'pin_unlock', when: '3 hrs ago', detail: 'Unlocked by PIN fallback' },
  { id: 'a5', device: 'Studio-Desktop', type: 'lockout', when: 'Yesterday', detail: '3 failed attempts · 30s lockout' },
  { id: 'a6', device: 'Studio-Desktop', type: 'enrolled', when: '2 days ago', detail: 'Voice profile enrolled · 3 samples' },
]

export const eventMeta: Record<ActivityEvent['type'], { label: string; tone: 'good' | 'bad' | 'neutral' }> = {
  voice_unlock: { label: 'Voice unlock', tone: 'good' },
  pin_unlock: { label: 'PIN unlock', tone: 'neutral' },
  voice_rejected: { label: 'Voice rejected', tone: 'bad' },
  lockout: { label: 'Lockout', tone: 'bad' },
  enrolled: { label: 'Enrolled', tone: 'neutral' },
}
