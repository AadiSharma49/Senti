import { useVoiceUnlockStore } from '../state/voiceUnlockStore'
import { VoicePhrase } from '../types/unlockProfiles'

export class VoiceProfileManager {
  private get store() {
    return useVoiceUnlockStore.getState()
  }

  getPrimaryPhrase(): string | null {
    return this.store.profile.primaryPhrase?.phrase || null
  }

  getProfile() {
    return this.store.profile
  }

  savePhrase(phrase: VoicePhrase) {
    this.store.recordPhrase(phrase)
  }

  confirmPhrase(index: number) {
    this.store.confirmPhrase(index)
  }

  completeTraining() {
    this.store.completeTraining()
  }

  reset() {
    this.store.resetProfile()
  }

  hasWakePhrase(): boolean {
    return !!this.getPrimaryPhrase()
  }
}
