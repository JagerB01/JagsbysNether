// One entry point loads both subsystems exactly once. Their original namespaces
// and commands stay intact so existing blocks/items remain recognizable.
import './settlements/main.js';
import './agriculture/main.js';

console.warn("[Jagsby's Underworld] v0.1.1 loaded.");
