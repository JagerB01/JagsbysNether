// One entry point loads settlements, agriculture and fishing once. Namespaces
// and commands stay intact so existing blocks/items remain recognizable.
import './settlements/main.js';
import './agriculture/main.js';
import './lava_fishing/main.js';
import './skitterchests.js';
import './hongos.js';

console.warn("[Jagsby's Underworld] v0.2.46 loaded.");
