type BrandLogoProps = {
  compact?: boolean;
  label?: string;
};

export const BrandLogo = ({ compact = false, label = "GOL DE OURO" }: BrandLogoProps) => (
  <div className="brand-lockup" aria-label={label}>
    <div className="brand-mark" aria-hidden="true">
      <div className="brand-ball">
        <div className="brand-ball-core" />
      </div>
    </div>
    {!compact ? (
      <div className="brand-wordmark">
        <span>GOL DE</span>
        <strong>OURO</strong>
      </div>
    ) : null}
  </div>
);
