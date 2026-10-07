# PAGE FIGHT // Anomaly Purge Protocol

A real-time 3D WebGL interactive browser game built with **Three.js** and zero-dependency procedural **Web Audio API** sound synthesis. 

The premise: an unhinged computer character enters a blind berserk rage, doing everything in its power to destroy your mouse cursor. The cursor is completely invincible, protected by a reactive 3D hexagonal energy shield that deflects bullets, meteors, rockets, javelins, and hurled debris.

When attacks miss the cursor, they fracture and demolish the surrounding 3D architectural scenery and chewing through the structural floor slabs until the foundation suffers catastrophic failure—plunging the character down a vertical abyss into the next subterranean biome.

---

## Gameplay Mechanics

* **Invincible Cursor Shield:** The mouse cursor is unprojected into 3D world space, casting a glowing hexagonal deflection barrier. Incoming projectiles ricochet with spark showers, screen shake trauma, and deflection audio.
* **Border Hunting Protocol:** When your mouse leaves the browser window (`mouseleave`), the character halts its attack, tracks your last known exit point, marches to the edge, and deploys spotlights / sonar pings across the screen bezel trying to hunt you down.
* **Destructible 3D Scenery & Auto-Decay:** Architectural props (towers, pillars, server mainframes, chandeliers) have structural hit points and crack decals. When destroyed, they fragment into 3D physics rubble. **Debris automatically dissolves and fades away into dust after settling** to keep the battlefield clean and performance locked at 60 FPS.
* **Destructible Floor & Catastrophic Collapse:** The floor is composed of segmented 3D structural slabs. Direct hits from explosions, ground pounds, and robot slams fracture the ground. Once integrity fails, the floor caves in and everyone enters a vertical freefall sequence with rushing subterranean shaft walls, slamming into the next depth tier.

---

## Character Roster

1. **The Wizard (`[1]`):** Levitation kinematics with flowing velvet robes, gnarled staff with a glowing point light, and celestial runes. Summons 3-way homing arcane missiles, calls down flaming 3D meteors that crater the floor, and casts chain lightning.
2. **The Soldier (`[2]`):** Tactical combat loadout with night-vision monocle, plate carrier, and assault rifle. Fires automatic tracer bursts with muzzle flashes and ejected brass casings, throws fragmentation grenades, and launches shoulder-fired RPG rockets.
3. **The Knight (`[3]`):** Burnished steel plate armor with PBR metallic reflections, crimson cape, and greatsword. Swings Zweihänder blade waves, hurls heavy spears that impale into props or the floor, and performs earthquake shield slams.
4. **The Robot (`[4]`):** Industrial demolition mech with caution hazard striping and cyclops spotlight. Features an **extendable multi-stage hydraulic scissor arm** that reaches across the screen, **physically rips scenery props and floor slabs right out of the ground**, and heaves the massive debris directly at the mouse cursor.
5. **Squad Mode:** Deploys all four characters simultaneously into an unhinged multi-combatant brawl against your cursor.

---

## Controls

| Key / Action | Action |
|---|---|
| **Move Cursor** | Provoke attack / Aim shield |
| **Exit Window** | Trigger edge hunting search protocol |
| **`1` / `2` / `3` / `4`** | Swap between Wizard, Soldier, Knight, and Robot |
| **`R`** | Rebuild / Regenerate current scene |
| **`M`** | Toggle audio synthesis |

---

## Tech Stack

* **Three.js (WebGL 3D Engine)**: PBR `MeshStandardMaterial`, PCF soft shadow maps, tone mapping, procedural 3D meshes, and unprojected raycast plane tracking.
* **Web Audio API**: Zero external audio files. Real-time procedural synthesis for gunfire, explosions, laser sweeps, sword clangs, servos, and earthquake rumbles.
* **Physics & Particle System**: Rigid-body linear and angular velocities, restitution, gravity, Voronoi-like fragmentation, and auto-decay lifecycle management.

---

## Local Development

Open `index.html` directly in your browser:
```bash
open index.html
```

Or run via any local HTTP server:
```bash
python3 -m http.server 8080
```
Then navigate to `http://localhost:8080`.
