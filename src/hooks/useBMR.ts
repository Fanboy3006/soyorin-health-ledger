// ═══════════════════════════════════════════════════════════════════
// BMR 计算逻辑 Hook
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { db, calcBMR, type UserProfile } from '../lib/db'
import { r0 } from '../utils/formatters'

export function useBMR(
  profile: UserProfile | null,
  setProfile: (p: UserProfile) => void,
) {
  const bmr = profile
    ? calcBMR(profile.weightLbs, profile.heightCm, profile.age, profile.gender)
    : 0

  const baseBurn = profile
    ? r0(bmr * (profile.activityFactor ?? 1.0))
    : 0

  const handleBmrSave = useCallback(
    async (p: UserProfile) => {
      const existing = await db.userProfile.limit(1).first()
      if (existing?.id) {
        await db.userProfile.update(existing.id, p)
      } else {
        await db.userProfile.add(p)
      }
      setProfile(p)
    },
    [setProfile],
  )

  return { bmr, baseBurn, handleBmrSave }
}
