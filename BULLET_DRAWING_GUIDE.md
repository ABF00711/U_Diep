# Programmatic Bullet Drawing Guide

Quick reference for drawing bullets/projectiles programmatically using Canvas, similar to diep.io style.

---

## 1. Simple Bullet (Basic)

```javascript
class Bullet {
  constructor(x, y, angle, speed, options = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.size = options.size || 4; // Bullet radius
    this.color = options.color || '#fff'; // White bullet
    this.damage = options.damage || 10;
    this.penetration = options.penetration || 1;
    this.ownerId = options.ownerId || null;
  }

  update(deltaTime) {
    // Move bullet
    this.x += Math.cos(this.angle) * this.speed * deltaTime;
    this.y += Math.sin(this.angle) * this.speed * deltaTime;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Draw bullet (circle)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Outline for visibility
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
```

---

## 2. Enhanced Bullet (With Trail)

```javascript
class EnhancedBullet {
  constructor(x, y, angle, speed, options = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.size = options.size || 4;
    this.color = options.color || '#fff';
    this.trailLength = options.trailLength || 5;
    this.trail = []; // Store previous positions
  }

  update(deltaTime) {
    // Store current position for trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.trailLength) {
      this.trail.shift();
    }

    // Move bullet
    this.x += Math.cos(this.angle) * this.speed * deltaTime;
    this.y += Math.sin(this.angle) * this.speed * deltaTime;
  }

  draw(ctx) {
    // Draw trail
    if (this.trail.length > 1) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size * 0.5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Draw bullet
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
```

---

## 3. Bullet Variants (Based on Tank Stats)

```javascript
class BulletRenderer {
  static createBullet(x, y, angle, speed, tankStats) {
    const bulletSize = 3 + (tankStats.bulletDamage || 0) * 0.5;
    const bulletColor = this.getBulletColor(tankStats);
    
    return new Bullet(x, y, angle, speed, {
      size: bulletSize,
      color: bulletColor,
      damage: 10 + (tankStats.bulletDamage || 0) * 2,
      penetration: 1 + (tankStats.bulletPenetration || 0),
    });
  }

  static getBulletColor(stats) {
    // Color based on bullet damage/penetration
    if (stats.bulletDamage > 5) {
      return '#ff6b6b'; // Red for high damage
    } else if (stats.bulletPenetration > 5) {
      return '#4ecdc4'; // Cyan for high penetration
    }
    return '#fff'; // White default
  }
}
```

---

## 4. Bullet Colors (Player vs Enemy)

```javascript
class Bullet {
  constructor(x, y, angle, speed, options = {}) {
    // ... other properties
    
    // Color based on owner
    if (options.isPlayer) {
      this.color = '#4a90e2'; // Blue for player bullets
    } else {
      this.color = '#e24a4a'; // Red for enemy bullets
    }
  }
}
```

---

## 5. Performance Optimization

### **Object Pooling for Bullets**

```javascript
class BulletPool {
  constructor(maxSize = 100) {
    this.pool = [];
    this.active = [];
    this.maxSize = maxSize;
  }

  get(x, y, angle, speed, options) {
    let bullet;
    if (this.pool.length > 0) {
      bullet = this.pool.pop();
      // Reset bullet properties
      bullet.x = x;
      bullet.y = y;
      bullet.angle = angle;
      bullet.speed = speed;
      Object.assign(bullet, options);
    } else {
      bullet = new Bullet(x, y, angle, speed, options);
    }
    this.active.push(bullet);
    return bullet;
  }

  release(bullet) {
    const index = this.active.indexOf(bullet);
    if (index > -1) {
      this.active.splice(index, 1);
      if (this.pool.length < this.maxSize) {
        this.pool.push(bullet);
      }
    }
  }

  updateAll(deltaTime) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const bullet = this.active[i];
      bullet.update(deltaTime);
      
      // Remove if out of bounds
      if (bullet.x < 0 || bullet.x > canvas.width || 
          bullet.y < 0 || bullet.y > canvas.height) {
        this.release(bullet);
      }
    }
  }

  drawAll(ctx) {
    for (const bullet of this.active) {
      bullet.draw(ctx);
    }
  }
}
```

---

## 6. Complete Bullet System Example

```javascript
class BulletSystem {
  constructor() {
    this.bullets = [];
    this.pool = new BulletPool(200);
  }

  shoot(tank, tankStats) {
    // Calculate bullet spawn position (at end of barrel)
    const barrelEndX = tank.x + Math.cos(tank.angle) * (tank.size + tank.barrelLength);
    const barrelEndY = tank.y + Math.sin(tank.angle) * (tank.size + tank.barrelLength);
    
    // Calculate bullet speed based on stats
    const baseSpeed = 500;
    const bulletSpeed = baseSpeed + (tankStats.bulletSpeed || 0) * 50;
    
    // Create bullet
    const bullet = this.pool.get(
      barrelEndX,
      barrelEndY,
      tank.angle,
      bulletSpeed,
      {
        size: 3 + (tankStats.bulletDamage || 0) * 0.5,
        color: tank.isPlayer ? '#4a90e2' : '#e24a4a',
        damage: 10 + (tankStats.bulletDamage || 0) * 2,
        penetration: 1 + (tankStats.bulletPenetration || 0),
        ownerId: tank.id,
        isPlayer: tank.isPlayer
      }
    );
    
    this.bullets.push(bullet);
  }

  update(deltaTime) {
    this.pool.updateAll(deltaTime);
    
    // Update bullets array
    this.bullets = this.bullets.filter(bullet => 
      this.pool.active.includes(bullet)
    );
  }

  draw(ctx) {
    this.pool.drawAll(ctx);
  }

  checkCollisions(tanks) {
    for (const bullet of this.pool.active) {
      for (const tank of tanks) {
        if (bullet.ownerId === tank.id) continue; // Can't hit self
        
        const dx = bullet.x - tank.x;
        const dy = bullet.y - tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < tank.size + bullet.size) {
          // Hit!
          tank.takeDamage(bullet.damage);
          bullet.penetration--;
          
          if (bullet.penetration <= 0) {
            this.pool.release(bullet);
          }
          break;
        }
      }
    }
  }
}
```

---

## 7. Usage Example

```javascript
// Initialize bullet system
const bulletSystem = new BulletSystem();

// Player shoots
function onShoot() {
  bulletSystem.shoot(playerTank, playerTank.stats);
}

// Game loop
function gameLoop(deltaTime) {
  // Update bullets
  bulletSystem.update(deltaTime);
  
  // Check collisions
  bulletSystem.checkCollisions([playerTank, ...enemyTanks]);
  
  // Draw bullets
  bulletSystem.draw(ctx);
  
  requestAnimationFrame(() => gameLoop(0.016));
}
```

---

## 8. Tips

- **Keep bullets simple** - Small circles work best
- **Use object pooling** - Critical for performance with many bullets
- **Color code** - Blue for player, red for enemies
- **Size based on stats** - Bigger bullets = more damage
- **Trail effects** - Optional, adds polish but costs performance

---

This programmatic approach gives you:
- ✅ No image assets needed
- ✅ Easy to customize (size, color, speed)
- ✅ Good performance with pooling
- ✅ Matches diep.io style
