export const observedBreakpoints = {
  'RSI:Perseus': {
    'ballistic:3:11-Series Broadsword': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 82,
      },
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 34,
      },
    },
    'ballistic:3:Tarantula GT-870 Mk 3': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: true,
      },
      shieldsUp: {
        source: 'estimated',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 42,
        estimatedArmorOnsetBand: [38, 44],
        notes: ['Estimated from Broadsword S3 at 34% and Tarantula GT-870 Mk 3 higher alpha.'],
      },
    },
    'ballistic:3:Deadbolt III': {
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: true,
      },
    },
    'ballistic:5:Deadbolt V': {
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: true,
      },
    },
    'ballistic:8:RSI Medusa': {
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: true,
      },
    },
  },
  rsi_perseus: {
    'ballistic:3:11-Series Broadsword': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 82,
      },
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 34,
      },
    },
    'ballistic:3:Tarantula GT-870 Mk 3': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: true,
      },
      shieldsUp: {
        source: 'estimated',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 42,
        estimatedArmorOnsetBand: [38, 44],
        notes: ['Estimated from Broadsword S3 at 34% and Tarantula GT-870 Mk 3 higher alpha.'],
      },
    },
    'ballistic:3:Deadbolt III': {
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: true,
      },
    },
    'ballistic:5:Deadbolt V': {
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: true,
      },
    },
    'ballistic:8:RSI Medusa': {
      shieldsUp: {
        source: 'observed',
        damagesFreshArmor: true,
      },
    },
  },
} as const
