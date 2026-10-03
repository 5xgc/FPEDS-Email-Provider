import moralTownLogo from '@assets/1a92c7cd-9191-4ab4-8006-ae0a752cba6a-removebg-preview_1791068175319.png';

export function BrandLogo() {
  return (
    <span className="brand-mark" aria-label="MoralTown">
      <img src={moralTownLogo} alt="MoralTown" />
    </span>
  );
}