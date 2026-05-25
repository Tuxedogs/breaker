import MaterialIcon from "../../logistics/MaterialIcon";

export function MaterialNameCell({ name, miningMethod, iconSize = 16 }: { name: string; miningMethod?: string; iconSize?: number }) {
  return (
    <span className="mining-material-name-cell">
      <MaterialIcon materialName={name} miningMethod={miningMethod} size={iconSize} className="mining-material-icon" />
      <span className="mining-material-name-text">{name}</span>
    </span>
  );
}
