export interface Vec {
  x: number;
  y: number;
}

/**
 * A polyline through tile centers. Positions are in tile units: tile (c, r) has its center at
 * (c + 0.5, r + 0.5). Enemies track how far they have moved (`distance`) and ask for the point.
 * Ground paths must be axis-aligned (see `tiles`); air routes may be diagonal.
 */
export class Path {
  readonly points: Vec[];
  readonly length: number;
  private readonly cumulative: number[];

  constructor(readonly waypoints: readonly (readonly [number, number])[]) {
    if (waypoints.length < 2) throw new Error('A path needs at least 2 waypoints');
    this.points = waypoints.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  /** Point at `distance` along the path, clamped to the ends. */
  pointAt(distance: number): Vec {
    if (distance <= 0) return { ...this.points[0] };
    if (distance >= this.length) return { ...this.points[this.points.length - 1] };
    let i = 1;
    while (this.cumulative[i] < distance) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const t = (distance - this.cumulative[i - 1]) / (this.cumulative[i] - this.cumulative[i - 1]);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Every tile the path passes through, including off-map ones. Only valid for axis-aligned paths. */
  tiles(): [number, number][] {
    const out: [number, number][] = [];
    const seen = new Set<string>();
    for (let i = 1; i < this.waypoints.length; i++) {
      const [c0, r0] = this.waypoints[i - 1];
      const [c1, r1] = this.waypoints[i];
      if (c0 !== c1 && r0 !== r1) throw new Error(`Path segment ${i} is not horizontal or vertical`);
      const steps = Math.abs(c1 - c0) + Math.abs(r1 - r0);
      for (let s = 0; s <= steps; s++) {
        const c = c0 + Math.sign(c1 - c0) * s;
        const r = r0 + Math.sign(r1 - r0) * s;
        const key = `${c},${r}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push([c, r]);
        }
      }
    }
    return out;
  }
}
