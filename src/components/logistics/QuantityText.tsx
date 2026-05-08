interface QuantityTokens {
  sign?: string;
  prefixUnit?: string;
  value?: string;
  suffixUnit?: string;
}

interface QuantityTextProps {
  value: string | number;
  className?: string;
}

function parseQuantityText(rawValue: string): QuantityTokens | null {
  const text = rawValue.trim();
  if (!text) return null;

  const scuMatch = text.match(/^([+-]?)(\d+(?:\.\d+)?)\s+(SCU)$/i);
  if (scuMatch) {
    return {
      sign: scuMatch[1] || undefined,
      value: scuMatch[2],
      suffixUnit: scuMatch[3],
    };
  }

  const xUnitMatch = text.match(/^([+-]?)(x)(\d+(?:\.\d+)?)$/i);
  if (xUnitMatch) {
    return {
      sign: xUnitMatch[1] || undefined,
      prefixUnit: xUnitMatch[2],
      value: xUnitMatch[3],
    };
  }

  return null;
}

export default function QuantityText({ value, className }: QuantityTextProps) {
  const text = String(value);
  const tokens = parseQuantityText(text);
  const quantityClassName = ['quantity', className].filter(Boolean).join(' ');

  if (!tokens) {
    return <span className={quantityClassName}>{text}</span>;
  }

  return (
    <span className={quantityClassName} aria-label={text}>
      {tokens.sign && <span className="quantity-sign">{tokens.sign}</span>}
      {tokens.prefixUnit && (
        <span className="quantity-unit quantity-unit--prefix">{tokens.prefixUnit}</span>
      )}
      {tokens.value && <span className="quantity-value">{tokens.value}</span>}
      {tokens.suffixUnit && (
        <span className="quantity-unit quantity-unit--suffix">{tokens.suffixUnit}</span>
      )}
    </span>
  );
}
