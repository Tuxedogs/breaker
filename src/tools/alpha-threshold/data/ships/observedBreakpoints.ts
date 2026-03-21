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
    'energy:4:Attrition-4': {
      shieldsDown: {
        source: 'estimated',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 60,
        estimatedArmorOnsetBand: [55, 65],
        notes: ['Estimated from Perseus ballistic anchor spacing and Attrition-4 shield-down armor performance.'],
      },
    },
    'energy:5:M7A': {
      shieldsDown: {
        source: 'estimated',
        damagesFreshArmor: true,
        armorDamageStartsAtPercent: 100,
        notes: ['Estimated as immediate shield-down armor damage on Perseus based on M7A alpha class.'],
      },
    },
    'energy:5:Omnisky XV': {
      shieldsDown: {
        source: 'estimated',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 71,
        estimatedArmorOnsetBand: [68, 74],
        notes: ['Estimated as a late shield-down armor onset on Perseus from current observed ballistic anchors and Omnisky XV alpha.'],
      },
    },
    'energy:3:NDB-30': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 80,
        notes: ['Observed shield-down onset on Perseus. NDB-30 does not damage intact armor.'],
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
    'energy:4:Attrition-4': {
      shieldsDown: {
        source: 'estimated',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 60,
        estimatedArmorOnsetBand: [55, 65],
        notes: ['Estimated from Perseus ballistic anchor spacing and Attrition-4 shield-down armor performance.'],
      },
    },
    'energy:5:M7A': {
      shieldsDown: {
        source: 'estimated',
        damagesFreshArmor: true,
        armorDamageStartsAtPercent: 100,
        notes: ['Estimated as immediate shield-down armor damage on Perseus based on M7A alpha class.'],
      },
    },
    'energy:5:Omnisky XV': {
      shieldsDown: {
        source: 'estimated',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 71,
        estimatedArmorOnsetBand: [68, 74],
        notes: ['Estimated as a late shield-down armor onset on Perseus from current observed ballistic anchors and Omnisky XV alpha.'],
      },
    },
    'energy:3:NDB-30': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: false,
        armorDamageStartsAtPercent: 80,
        notes: ['Observed shield-down onset on Perseus. NDB-30 does not damage intact armor.'],
      },
    },
  },
  'MRAI:Guardian': {
    'energy:3:NDB-30': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: true,
        notes: ['Observed shield-down result on Guardian. NDB-30 damages intact armor.'],
      },
    },
  },
  mrai_guardian: {
    'energy:3:NDB-30': {
      shieldsDown: {
        source: 'observed',
        damagesFreshArmor: true,
        notes: ['Observed shield-down result on Guardian. NDB-30 damages intact armor.'],
      },
    },
  },
} as const
