type MaterialIconProps = {
  materialName: string;
  miningMethod?: string;
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
  | 'dolivine'
  | 'hadanite'
  | 'aphorite'
  | 'metal'
  | 'copper'
  | 'ice'
  | 'greenCrystal'
  | 'rare'
  | 'default';

type IconShape = 'crystal' | 'roundOre' | 'squareOre';

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
  if (name.includes('dolivine')) return 'dolivine';
  if (name.includes('hadanite')) return 'hadanite';
  if (name.includes('aphorite')) return 'aphorite';

  if (/(iron|steel|osmium|tungsten|titanium)/.test(name)) return 'metal';
  if (/(copper|borase|beradom)/.test(name)) return 'copper';
  if (/(ice|pressurized ice|polacrete)/.test(name)) return 'ice';
  if (/(beryl|feynmaline)/.test(name)) return 'greenCrystal';
  if (/(agricium|volatile|rare)/.test(name)) return 'rare';

  return 'default';
}

function normalizeMaterialKey(name: string): string {
  return normalizeMaterialName(name).replace(/\s+/g, '');
}

const HAND_MINEABLE_KEYS = new Set([
  'aphorite',
  'carinitepure',
  'purecarinite',
  'dolivine',
  'hadanite',
  'jaclium',
  'janalite',
  'sadaryx',
  'saldynium',
]);

const GROUND_MINEABLE_KEYS = new Set([
  'beradom',
  'carinite',
  'feynmaline',
  'glacosite',
]);

function getIconShape(materialName: string, miningMethod: string | undefined, variant: IconVariant): IconShape {
  const method = (miningMethod ?? '').toLocaleLowerCase();
  if (variant === 'quantanium') return 'roundOre';
  if (method.includes('ground') || method.includes('vehicle') || method.includes('geoborne')) return 'squareOre';
  if (method.includes('hand') || method.includes('fps') || method.includes('handborne')) return 'crystal';
  if (
    method.includes('orbit') ||
    method.includes('space') ||
    method.includes('asteroid') ||
    method.includes('surface') ||
    method.includes('ship') ||
    method.includes('shipborne')
  ) {
    return 'roundOre';
  }

  const key = normalizeMaterialKey(materialName);
  if (GROUND_MINEABLE_KEYS.has(key)) return 'squareOre';
  if (HAND_MINEABLE_KEYS.has(key)) return 'crystal';
  return 'roundOre';
}

function getFallbackAccent(materialName: string): string {
  const accents = ['#8fa1a8', '#b08d57', '#4fa49a', '#7f8fc8', '#9c6f54'];
  return accents[hashName(materialName) % accents.length];
}

export default function MaterialIcon({ materialName, miningMethod, size = 20, className = '' }: MaterialIconProps) {
  const variant = getIconVariant(materialName);
  const shape = getIconShape(materialName, miningMethod, variant);
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
    dolivine: { base: '#36a86d', dark: '#07351f', accent: '#84f5aa', highlight: '#dcffe9' },
    hadanite: { base: '#c9b8e8', dark: '#302246', accent: '#9d7ad8', highlight: '#fbf7ff' },
    aphorite: { base: '#1857b8', dark: '#061a42', accent: '#3ca7ff', highlight: '#bfe3ff' },
    metal: { base: '#7c858b', dark: '#22282d', accent: '#b7c1c7', highlight: '#e0e7eb' },
    copper: { base: '#a65324', dark: '#29140c', accent: '#ff9b45', highlight: '#ffd09a' },
    ice: { base: '#72bfe8', dark: '#143249', accent: '#bdeeff', highlight: '#f0fbff' },
    greenCrystal: { base: '#2fbf9c', dark: '#07362e', accent: '#83ffe1', highlight: '#d9fff5' },
    rare: { base: '#bd6233', dark: '#281031', accent: '#b06cff', highlight: '#ffd37d' },
    default: { base: '#3c4548', dark: '#111619', accent: fallbackAccent, highlight: '#c7d0ce' },
  };

  const colors = palette[variant];
  const outline = '#030506';
  const isSquareOre = shape === 'squareOre';
  const outerOrePoints = isSquareOre
    ? '4,4 15,3 21,9 20,19 10,22 3,16'
    : '12,2.5 17.4,4.2 21.2,8.5 22,14.1 18.8,19.3 13.4,22 7.8,20.8 3.5,17.1 2.1,11.5 5.1,6.1';
  const innerOrePoints = isSquareOre
    ? '7,7 14,5.9 18.2,10.2 17.2,16.8 10.8,19 6.1,14.5'
    : '8.1,7.2 12.7,5.4 17.5,8.3 19.1,13.4 16.2,17.9 11.4,19.2 6.9,16.3 5.1,11.3';

  return (
    <span className={classes} aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" focusable="false">
        {shape === 'crystal' ? (
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
            <polygon points={outerOrePoints} fill={colors.dark} stroke={outline} strokeWidth="1.35" strokeLinejoin="miter" />
            <polygon points={innerOrePoints} fill={colors.base} stroke={outline} strokeWidth="0.55" strokeLinejoin="miter" />
            <polygon points={isSquareOre ? '7,7 6.1,14.5 11.5,12.5 14,5.9' : '8.1,7.2 5.1,11.3 11.4,11.8 12.7,5.4'} fill={colors.highlight} opacity={variant === 'stileron' ? 0.5 : 0.36} />
            <polygon points={isSquareOre ? '14,5.9 11.5,12.5 17.2,16.8 18.2,10.2' : '12.7,5.4 11.4,11.8 16.2,17.9 19.1,13.4 17.5,8.3'} fill={colors.accent} opacity={variant === 'default' || variant === 'metal' ? 0.38 : 0.78} />
            <polygon points={isSquareOre ? '6.1,14.5 10.8,19 17.2,16.8 11.5,12.5' : '6.9,16.3 11.4,19.2 16.2,17.9 11.4,11.8'} fill="#050708" opacity="0.4" />
            {(variant === 'torite' || variant === 'hephaestonite' || variant === 'copper') && (
              <polyline points={isSquareOre ? '7,13 11,12 14,8' : '6.8,12.5 11.3,11.7 15.5,8.4'} fill="none" stroke={colors.accent} strokeWidth="1.35" strokeLinecap="square" strokeLinejoin="miter" />
            )}
            {(variant === 'torite' || variant === 'copper') && (
              <polyline points={isSquareOre ? '11,12 14,16 18,14' : '11.3,11.7 14.2,16.3 18.2,13.8'} fill="none" stroke={colors.highlight} strokeWidth="1.05" strokeLinecap="square" strokeLinejoin="miter" />
            )}
            {variant === 'hephaestonite' && (
              <>
                <polygon points={isSquareOre ? '7,15 11,13 13,16 9,17' : '7.1,15.2 11.2,13.2 13.4,16.2 9.2,17.5'} fill={colors.highlight} opacity="0.82" />
                <polygon points={isSquareOre ? '14,8 18,10 16,12' : '14.6,8.3 18.5,10.2 16.1,12.5'} fill={colors.accent} opacity="0.86" />
              </>
            )}
            {variant === 'quantanium' && (
              <>
                <polyline points="7.2,14.7 11.5,11.7 13.1,15.8 17.8,12.6" fill="none" stroke={colors.accent} strokeWidth="1.35" strokeLinejoin="miter" />
                <path d="M18 5h2M19 4v2M4.8 8h2M5.8 7v2" stroke={colors.accent} strokeWidth="1.15" strokeLinecap="square" />
              </>
            )}
          </>
        )}
      </svg>
    </span>
  );
}
