import type { DiagnosisEntry } from '../types'

export const DIAGNOSIS: DiagnosisEntry[] = [
  {
    id: 'missing-shots-am',
    symptom: 'Missing shots in AM mode',
    cause: 'Pilot is making rapid course corrections, constantly resetting the gimbal cone center. Your aim is chasing their inputs instead of the target.',
    correction: 'Switch to PM for manual lead control, or communicate with the pilot to hold a steady line during your firing window.',
    relatedMode: 'AM',
  },
  {
    id: 'missing-shots-pm',
    symptom: 'Missing shots in PM mode',
    cause: "Lead compensation is off. At range, projectile travel time means you need to fire significantly ahead of the target's current position.",
    correction: 'Increase your lead offset. Use burst fire and walk shots onto the target rather than holding sustained fire on the wrong vector.',
    relatedMode: 'PM',
  },
  {
    id: 'losing-target',
    symptom: 'Losing target lock constantly',
    cause: 'Target is maneuvering out of your gimbal arc, or you are in AM mode against a fast target that keeps breaking the cone envelope.',
    correction: 'Switch to PM — it gives you full crosshair freedom without cone constraints. Communicate target vector to the pilot.',
    relatedMode: 'AM',
  },
  {
    id: 'shots-landing-no-damage',
    symptom: 'Shots landing but no damage registering',
    cause: 'Shield is absorbing all incoming fire. You have not broken the shield phase, or shields have regenerated between bursts.',
    correction: 'Focus fire with your crew on a single shield face. Coordinate burst timing so shields cannot regen between volleys. Sub-target shield generator to reduce regen rate.',
    relatedMode: null,
  },
  {
    id: 'cant-acquire-subtarget',
    symptom: 'Cannot acquire a sub-target',
    cause: 'Not using Precision Mode (ADS) to acquire the component. Sub-target acquisition requires PM mode to be active during selection.',
    correction: 'Enter ADS (Precision Mode) and aim at the component until the sub-target pip locks. Exit ADS immediately after. The sub-target persists after you exit.',
    relatedMode: 'PM',
    
  },
  {
    id: 'am-not-tracking',
    symptom: 'AM mode not tracking component',
    cause: 'Target is at mid or far range. The gimbal cone auto-correction envelope is too small to compensate for target angular velocity at this distance.',
    correction: 'Close distance until AM tracking feels stable, or switch to PM for the current engagement range. AM is most effective at close range on slow targets.',
    relatedMode: 'AM',
  },
  {
    id: 'subtarget-lost-after-switch',
    symptom: 'Sub-target lost after switching seats or modes',
    cause: 'Some sub-target locks do not persist across mode switches or seat changes depending on ship state.',
    correction: 'Re-acquire with ADS. Enter PM, aim at the component, wait for the pip, exit ADS. Keep note of the target component before switching.',
    relatedMode: null,
  },
]
