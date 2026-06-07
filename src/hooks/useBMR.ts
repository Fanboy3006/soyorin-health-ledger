// ═══════════════════════════════════════════════════════════════════
// BMR 计算逻辑 Hook（薄层，调用 engine）
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { calcBMR, type UserProfile } from '../lib/db'
import { saveUserProfile } from '../engine'
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
      await saveUserProfile(p)
      setProfile(p)
    },
    [setProfile],
  )

  return { bmr, baseBurn, handleBmrSave }
}
