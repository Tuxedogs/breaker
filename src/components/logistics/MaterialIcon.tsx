type MaterialIconProps = {
  materialName: string;
  size?: number;
  className?: string;
};

type IconVariant =
  | 'stileron'
  | 'torite'
  | 'hephaestonite'
  | 'savrilium'
  | 'carinite'
  | 'pureCarinite'
  | 'quantanium'
  | 'metal'
  | 'copper'
  | 'ice'
  | 'greenCrystal'
  | 'rare'
  | 'default';

function normalizeMaterialName(name: string): string {
  return name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hashName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getIconVariant(materialName: string): IconVariant {
  const name = normalizeMaterialName(materialName);

  if (name.includes('stileron')) return 'stileron';
  if (name.includes('torite')) return 'torite';
  if (name.includes('hephaestonite') || name.includes('hephaestanite') || name.includes('hephaestonice')) return 'hephaestonite';
  if (name.includes('savrilium') || name.includes('savillium') || name.includes('savrilum')) return 'savrilium';
  if (name.includes('pure carinite')) return 'pureCarinite';
  if (name === 'carinite' || name.includes(' carinite')) return 'carinite';
  if (name.includes('quantanium')) return 'quantanium';

  if (/(iron|steel|osmium|tungsten|titanium)/.test(name)) return 'metal';
  if (/(copper|borase|beradom)/.test(name)) return 'copper';
  if (/(ice|pressurized ice|polacrete)/.test(name)) return 'ice';
  if (/(beryl|hadanite|feynmaline)/.test(name)) return 'greenCrystal';
  if (/(agricium|volatile|rare)/.test(name)) return 'rare';

  return 'default';
}

function getFallbackAccent(materialName: string): string {
  const accents = ['#8fa1a8', '#b08d57', '#4fa49a', '#7f8fc8', '#9c6f54'];
  return accents[hashName(materialName) % accents.length];
}

export default function MaterialIcon({ materialName, size = 20, className = '' }: MaterialIconProps) {
  const variant = getIconVariant(materialName);
  const fallbackAccent = getFallbackAccent(materialName);
  const classes = ['bq-material-icon', className].filter(Boolean).join(' ');

  const palette: Record<IconVariant, { base: string; dark: string; accent: string; highlight: string }> = {
    stileron: { base: '#263241', dark: '#090d12', accent: '#5f7fa5', highlight: '#a7bdd4' },
    torite: { base: '#252527', dark: '#090807', accent: '#d46a25', highlight: '#ffaf58' },
    hephaestonite: { base: '#263540', dark: '#0a1015', accent: '#b36d3a', highlight: '#43a99c' },
    savrilium: { base: '#9fb8ad', dark: '#203b37', accent: '#c9ffed', highlight: '#f2fff9' },
    carinite: { base: '#d047aa', dark: '#3b1231', accent: '#ff7bd5', highlight: '#ffd4f1' },
    pureCarinite: { base: '#b5071d', dark: '#35040d', accent: '#ff2038', highlight: '#fff1f3' },
    quantanium: { base: '#6b35c8', dark: '#1b0d34', accent: '#f2a72e', highlight: '#d6b8ff' },
    metal: { base: '#7c858b', dark: '#22282d', accent: '#b7c1c7', highlight: '#e0e7eb' },
    copper: { base: '#a65324', dark: '#29140c', accent: '#ff9b45', highlight: '#ffd09a' },
    ice: { base: '#72bfe8', dark: '#143249', accent: '#bdeeff', highlight: '#f0fbff' },
    greenCrystal: { base: '#2fbf9c', dark: '#07362e', accent: '#83ffe1', highlight: '#d9fff5' },
    rare: { base: '#bd6233', dark: '#281031', accent: '#b06cff', highlight: '#ffd37d' },
    default: { base: '#3c4548', dark: '#111619', accent: fallbackAccent, highlight: '#c7d0ce' },
  };

  const colors = palette[variant];
  const isCrystal = variant === 'savrilium' || variant === 'carinite' || variant === 'pureCarinite' || variant === 'quantanium' || variant === 'ice' || variant === 'greenCrystal' || variant === 'rare';
  const outline = '#030506';

  return (
    <span className={classes} aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" focusable="false">
        {isCrystal ? (
          <>
            <polygon points="3,20 7,10 11,2 15,10 21,20 12,23" fill={colors.dark} stroke={outline} strokeWidth="1.4" strokeLinejoin="miter" />
            <polygon points="8,19 10,7 12,3 14,8 13,21" fill={colors.base} stroke={outline} strokeWidth="0.65" strokeLinejoin="miter" />
            <polygon points="4,19 7,11 11,20 8,22" fill={colors.accent} stroke={outline} strokeWidth="0.55" strokeLinejoin="miter" />
            <polygon points="14,9 19,19 14,21 12,13" fill={colors.accent} stroke={outline} strokeWidth="0.55" strokeLinejoin="miter" />
            <polygon points="10,7 12,3 13,8 12,14" fill={colors.highlight} opacity="0.92" />
            <polygon points="15,12 18,18 15,17" fill={colors.highlight} opacity="0.55" />
            {variant === 'quantanium' && (
              <>
                <polyline points="8,15 12,12 13,16 17,13" fill="none" stroke={colors.accent} strokeWidth="1.35" strokeLinejoin="miter" />
                <path d="M18 5h2M19 4v2M5 8h2M6 7v2" stroke={colors.accent} strokeWidth="1.15" strokeLinecap="square" />
              </>
            )}
          </>
        ) : (
          <>
            <polygon points="3,15 6,6 13,3 21,8 22,16 15,22 7,20" fill={colors.dark} stroke={outline} strokeWidth="1.35" strokeLinejoin="miter" />
            <polygon points="6,14 8,8 13,5 18,9 17,15 12,19 8,18" fill={colors.base} stroke={outline} strokeWidth="0.55" strokeLinejoin="miter" />
            <polygon points="8,8 6,14 12,12 13,5" fill={colors.highlight} opacity={variant === 'stileron' ? 0.5 : 0.36} />
            <polygon points="13,5 12,12 17,15 18,9" fill={colors.accent} opacity={variant === 'default' || variant === 'metal' ? 0.38 : 0.78} />
            <polygon points="8,18 12,12 17,15 12,19" fill="#050708" opacity="0.4" />
            <polygon points="4,15 8,18 7,20" fill={colors.dark} />
            {(variant === 'torite' || variant === 'hephaestonite' || variant === 'copper') && (
              <polyline points="7,13 11,12 14,8" fill="none" stroke={colors.accent} strokeWidth="1.35" strokeLinecap="square" strokeLinejoin="miter" />
            )}
            {(variant === 'torite' || variant === 'copper') && (
              <polyline points="11,12 14,16 18,14" fill="none" stroke={colors.highlight} strokeWidth="1.05" strokeLinecap="square" strokeLinejoin="miter" />
            )}
            {variant === 'hephaestonite' && (
              <>
                <polygon points="7,15 11,13 13,16 9,17" fill={colors.highlight} opacity="0.82" />
                <polygon points="14,8 18,10 16,12" fill={colors.accent} opacity="0.86" />
              </>
            )}
          </>
        )}
      </svg>
    </span>
  );
}
