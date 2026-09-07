const particles = [
  [4, 0, 7, 0.4], [12, 12, 10, 0.24], [20, -4, 8, 0.3], [29, 18, 12, 0.2],
  [37, 5, 9, 0.28], [46, 22, 11, 0.3], [54, -8, 7, 0.22], [63, 10, 13, 0.2],
  [72, 2, 8, 0.34], [81, 25, 10, 0.24], [91, 8, 14, 0.2], [97, 30, 9, 0.28],
  [8, 40, 11, 0.22], [17, 65, 9, 0.3], [26, 48, 13, 0.18], [34, 77, 8, 0.24],
  [43, 56, 12, 0.24], [52, 82, 10, 0.22], [61, 43, 8, 0.3], [70, 69, 11, 0.2],
  [79, 50, 14, 0.18], [88, 75, 9, 0.28], [95, 60, 12, 0.2], [58, 92, 8, 0.22],
];

export function ParticleField({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${dense ? 'opacity-80' : 'opacity-55'}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,hsl(0_0%_100%/.07),transparent_38%)]" />
      {particles.map(([left, top, size, opacity], index) => (
        <span
          key={index}
          className="absolute top-0 rounded-full bg-white animate-particle-fall"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${Math.max(2, size / 2.2)}px`,
            height: `${Math.max(2, size / 2.2)}px`,
            opacity: Math.max(opacity, 0.75),
            boxShadow: `0 0 ${Math.max(5, size)}px hsl(0 0% 100% / ${Math.max(opacity, 0.75)})`,
            animation: `particle-fall ${4.5 + (index % 5) * 0.75}s linear ${index * -0.55}s infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}