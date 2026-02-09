# Programmatic Tank Drawing Guide

This guide provides code examples and best practices for drawing tanks programmatically using HTML5 Canvas, similar to diep.io style.

---

## Basic Tank Structure

A tank consists of:
1. **Body** - Main circular/square base
2. **Barrel** - Rotating cannon that follows mouse
3. **Optional:** Health bar, level indicator, name tag

---

## 1. Simple Tank Drawing (Basic)

### **Circular Tank (diep.io style)**

```javascript
class Tank {
  constructor(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.angle = angle; // Barrel rotation angle
    this.size = 30; // Tank body radius
    this.barrelLength = 25;
    this.barrelWidth = 8;
    this.color = '#4a90e2'; // Blue for player, red for enemies
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw tank body (circle)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw body outline
    ctx.strokeStyle = '#2a5a8a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw barrel (rotating rectangle)
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
    
    // Barrel tip (darker)
    ctx.fillStyle = '#1a3a5a';
    ctx.fillRect(this.size + this.barrelLength - 3, -this.barrelWidth / 2, 3, this.barrelWidth);

    ctx.restore();
  }
}
```

---

## 2. Enhanced Tank Drawing (With Details)

### **Tank with Health Bar and Level**

```javascript
class EnhancedTank {
  constructor(x, y, angle = 0, options = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.size = options.size || 30;
    this.barrelLength = options.barrelLength || 25;
    this.barrelWidth = options.barrelWidth || 8;
    this.color = options.color || '#4a90e2';
    this.health = options.health || 100;
    this.maxHealth = options.maxHealth || 100;
    this.level = options.level || 1;
    this.name = options.name || 'Player';
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw tank body (circle with gradient)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, this.darkenColor(this.color, 0.3));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Body outline
    ctx.strokeStyle = this.darkenColor(this.color, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw barrel
    ctx.rotate(this.angle);
    const barrelGradient = ctx.createLinearGradient(
      this.size, -this.barrelWidth / 2,
      this.size + this.barrelLength, -this.barrelWidth / 2
    );
    barrelGradient.addColorStop(0, this.darkenColor(this.color, 0.4));
    barrelGradient.addColorStop(1, this.darkenColor(this.color, 0.6));
    
    ctx.fillStyle = barrelGradient;
    ctx.fillRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
    
    // Barrel outline
    ctx.strokeStyle = this.darkenColor(this.color, 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);

    ctx.restore();

    // Draw health bar above tank
    this.drawHealthBar(ctx);
    
    // Draw level indicator
    this.drawLevel(ctx);
    
    // Draw name tag
    this.drawName(ctx);
  }

  drawHealthBar(ctx) {
    const barWidth = this.size * 2;
    const barHeight = 4;
    const barX = this.x - barWidth / 2;
    const barY = this.y - this.size - 15;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  drawLevel(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(`Lv.${this.level}`, this.x, this.y - this.size - 25);
    ctx.fillText(`Lv.${this.level}`, this.x, this.y - this.size - 25);
  }

  drawName(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(this.name, this.x, this.y - this.size - 35);
    ctx.fillText(this.name, this.x, this.y - this.size - 35);
  }

  darkenColor(color, amount) {
    // Simple color darkening (for gradients)
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  }
}
```

---

## 3. Tank Variants (Different Shapes)

### **Square Tank**

```javascript
drawSquareTank(ctx, x, y, angle, size = 30) {
  ctx.save();
  ctx.translate(x, y);
  
  // Square body
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.strokeStyle = '#2a5a8a';
  ctx.lineWidth = 2;
  ctx.strokeRect(-size, -size, size * 2, size * 2);
  
  // Barrel
  ctx.rotate(angle);
  ctx.fillStyle = '#2a5a8a';
  ctx.fillRect(size, -6, 25, 12);
  
  ctx.restore();
}
```

### **Triangle Tank**

```javascript
drawTriangleTank(ctx, x, y, angle, size = 30) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Triangle body (pointing forward)
  ctx.fillStyle = '#4a90e2';
  ctx.beginPath();
  ctx.moveTo(size + 20, 0); // Front point
  ctx.lineTo(-size, -size); // Back left
  ctx.lineTo(-size, size);  // Back right
  ctx.closePath();
  ctx.fill();
  
  ctx.strokeStyle = '#2a5a8a';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.restore();
}
```

---

## 4. Tank Colors (Player vs Enemy)

```javascript
class TankRenderer {
  static getPlayerColor() {
    return '#4a90e2'; // Blue
  }

  static getEnemyColor() {
    return '#e24a4a'; // Red
  }

  static getNeutralColor() {
    return '#4ae2a8'; // Green/Teal
  }

  static getColorByTeam(teamId) {
    const colors = [
      '#4a90e2', // Blue
      '#e24a4a', // Red
      '#4ae2a8', // Green
      '#e2a84a', // Orange
      '#a84ae2', // Purple
    ];
    return colors[teamId % colors.length];
  }
}
```

---

## 5. Tank Stats Visualization

### **Show Tank Stats (Health Regen, Max Health, etc.)**

```javascript
drawTankStats(ctx, tank, showDetails = false) {
  const statsY = tank.y + tank.size + 5;
  
  if (showDetails) {
    // Draw stat bars around tank
    const stats = {
      'Health Regen': tank.stats.healthRegen || 0,
      'Max Health': tank.stats.maxHealth || 0,
      'Body Damage': tank.stats.bodyDamage || 0,
      'Bullet Speed': tank.stats.bulletSpeed || 0,
      'Bullet Penetration': tank.stats.bulletPenetration || 0,
      'Bullet Damage': tank.stats.bulletDamage || 0,
      'Reload': tank.stats.reload || 0,
      'Movement Speed': tank.stats.movementSpeed || 0,
    };

    let yOffset = 0;
    Object.entries(stats).forEach(([name, value], index) => {
      const barWidth = 60;
      const barHeight = 3;
      const x = tank.x - barWidth / 2;
      const y = statsY + yOffset;

      // Background
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, barWidth, barHeight);

      // Stat fill (normalized to 0-1)
      const normalized = Math.min(value / 7, 1); // Assuming max stat is 7
      ctx.fillStyle = '#4a90e2';
      ctx.fillRect(x, y, barWidth * normalized, barHeight);

      yOffset += 5;
    });
  }
}
```

---

## 6. Performance Optimization

### **Use Object Pooling for Tank Rendering**

```javascript
class TankRenderer {
  constructor() {
    this.cache = new Map(); // Cache rendered tanks
  }

  drawTank(ctx, tank, isPlayer = false) {
    const cacheKey = `${tank.level}-${isPlayer}`;
    
    // Use cached rendering if available
    if (this.cache.has(cacheKey)) {
      // Draw from cache (for static parts)
      // Still need to rotate barrel dynamically
    } else {
      // Render and cache
      this.renderTank(ctx, tank, isPlayer);
    }
  }

  renderTank(ctx, tank, isPlayer) {
    // Render tank to offscreen canvas
    // Cache the result
    // Use for multiple tanks with same appearance
  }
}
```

---

## 7. Complete Tank Class Example

```javascript
class Tank {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.angle = options.angle || 0;
    this.size = options.size || 30;
    this.barrelLength = options.barrelLength || 25;
    this.barrelWidth = options.barrelWidth || 8;
    this.color = options.color || '#4a90e2';
    this.health = options.health || 100;
    this.maxHealth = options.maxHealth || 100;
    this.level = options.level || 1;
    this.name = options.name || 'Player';
    
    // Tank stats (diep.io style)
    this.stats = {
      healthRegen: options.healthRegen || 0,
      maxHealth: options.maxHealth || 0,
      bodyDamage: options.bodyDamage || 0,
      bulletSpeed: options.bulletSpeed || 0,
      bulletPenetration: options.bulletPenetration || 0,
      bulletDamage: options.bulletDamage || 0,
      reload: options.reload || 0,
      movementSpeed: options.movementSpeed || 0,
    };
  }

  update(deltaTime) {
    // Update tank logic (movement, rotation, etc.)
  }

  draw(ctx, isPlayer = false) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw body
    this.drawBody(ctx);
    
    // Draw barrel
    this.drawBarrel(ctx);
    
    ctx.restore();

    // Draw UI elements
    this.drawHealthBar(ctx);
    this.drawLevel(ctx);
    if (isPlayer || this.name) {
      this.drawName(ctx);
    }
  }

  drawBody(ctx) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, this.darkenColor(this.color, 0.3));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = this.darkenColor(this.color, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawBarrel(ctx) {
    ctx.rotate(this.angle);
    
    const barrelGradient = ctx.createLinearGradient(
      this.size, -this.barrelWidth / 2,
      this.size + this.barrelLength, -this.barrelWidth / 2
    );
    barrelGradient.addColorStop(0, this.darkenColor(this.color, 0.4));
    barrelGradient.addColorStop(1, this.darkenColor(this.color, 0.6));
    
    ctx.fillStyle = barrelGradient;
    ctx.fillRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
    
    ctx.strokeStyle = this.darkenColor(this.color, 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
  }

  drawHealthBar(ctx) {
    const barWidth = this.size * 2;
    const barHeight = 4;
    const barX = this.x - barWidth / 2;
    const barY = this.y - this.size - 15;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  drawLevel(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(`Lv.${this.level}`, this.x, this.y - this.size - 25);
    ctx.fillText(`Lv.${this.level}`, this.x, this.y - this.size - 25);
  }

  drawName(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(this.name, this.x, this.y - this.size - 35);
    ctx.fillText(this.name, this.x, this.y - this.size - 35);
  }

  darkenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  }
}
```

---

## 8. Usage Example

```javascript
// Initialize canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Create player tank
const playerTank = new Tank(400, 300, {
  color: '#4a90e2',
  level: 5,
  name: 'Player1',
  health: 80,
  maxHealth: 100
});

// Create enemy tank
const enemyTank = new Tank(600, 400, {
  color: '#e24a4a',
  level: 3,
  name: 'Enemy1',
  health: 50,
  maxHealth: 100
});

// Game loop
function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update barrel angle (follow mouse)
  const mouseX = /* get mouse X */;
  const mouseY = /* get mouse Y */;
  playerTank.angle = Math.atan2(mouseY - playerTank.y, mouseX - playerTank.x);
  
  // Draw tanks
  playerTank.draw(ctx, true); // true = is player
  enemyTank.draw(ctx, false);
  
  requestAnimationFrame(gameLoop);
}

gameLoop();
```

---

## 9. Tips & Best Practices

### **Performance:**
- Draw tanks in order (players first, then enemies)
- Use `ctx.save()` and `ctx.restore()` for transformations
- Cache gradients if drawing many tanks
- Consider using offscreen canvas for static parts

### **Visual Polish:**
- Add subtle shadows for depth
- Use gradients for 3D effect
- Add outline/stroke for visibility
- Color-code by team/player status

### **Scalability:**
- Tank size can scale with level
- Barrel length can scale with bullet range stat
- Colors can change based on tank type/upgrade

### **diep.io Style:**
- Simple, clean shapes
- Bright, distinct colors
- Clear outlines for visibility
- Minimal details (focus on gameplay)

---

## 10. Next Steps

1. **Implement basic tank class** (use example above)
2. **Add mouse tracking** for barrel rotation
3. **Add movement** (WASD keys)
4. **Add collision detection** (tank vs tank, tank vs bullets)
5. **Add visual effects** (particles on movement, hit effects)

This programmatic approach gives you:
- ✅ No image assets needed
- ✅ Easy to modify and customize
- ✅ Good performance
- ✅ Scalable (easy to add variants)
- ✅ Matches diep.io style
